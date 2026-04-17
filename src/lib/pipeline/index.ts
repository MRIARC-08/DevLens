// src/lib/pipeline/index.ts
// Pipeline Orchestrator — called by the API route after creating a repo record.
// Runs the full 6-step pipeline sequentially and updates DB at every stage.

import fs from "fs";
import { prisma } from "@/lib/prisma";
import { cloneRepository } from "./cloner";
import { walkRepository } from "./walker";
import { parseFile } from "./parser";
import { resolveImports } from "./resolver";
import { classifyFile } from "./classifier";
import { calculateInsights } from "./insights";
import { RepositoryStatus, FileType, ParseStatus } from "@prisma/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Update repository status and human-readable message in a single call */
async function updateStatus(
  repoId: string,
  status: RepositoryStatus,
  statusMessage: string,
  extra?: Record<string, unknown>
): Promise<void> {
  await prisma.repository.update({
    where: { id: repoId },
    data: { status, statusMessage, ...extra },
  });
}

/** Remove the cloned directory from disk, silently ignore errors */
function cleanupClone(clonedPath: string): void {
  try {
    if (fs.existsSync(clonedPath)) {
      fs.rmSync(clonedPath, { recursive: true, force: true });
      console.log(`[pipeline] Cleaned up clone at ${clonedPath}`);
    }
  } catch (err) {
    console.warn(`[pipeline] Could not clean up ${clonedPath}:`, err);
  }
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Run the full DevLens processing pipeline for a given repository.
 *
 * This function is designed to be called fire-and-forget from the API route
 * (without await) so the HTTP response can return immediately while processing
 * happens in the background.
 *
 * @param repoId  The repository record's ID in the database
 */
export async function processRepository(repoId: string): Promise<void> {
  console.log(`\n[pipeline] ═══ Starting pipeline for repo ${repoId} ═══`);

  let clonedPath: string | null = null;

  try {
    // Fetch the repo record to get the URL
    const repo = await prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repo) {
      throw new Error(`Repository ${repoId} not found in database`);
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: CLONE
    // ─────────────────────────────────────────────────────────────────────
    console.log(`[pipeline] Step 1 — Cloning ${repo.url}`);
    await updateStatus(repoId, RepositoryStatus.CLONING, "Cloning repository...");

    clonedPath = await cloneRepository(repo.url, repoId);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: WALK — read file tree
    // ─────────────────────────────────────────────────────────────────────
    console.log(`[pipeline] Step 2 — Walking file tree`);
    await updateStatus(repoId, RepositoryStatus.READING, "Reading files...");

    const walkedFiles = await walkRepository(clonedPath);

    await prisma.repository.update({
      where: { id: repoId },
      data: {
        totalFiles: walkedFiles.length,
        statusMessage: `Reading ${walkedFiles.length} files...`,
      },
    });

    if (walkedFiles.length === 0) {
      throw new Error(
        "No parseable source files found in this repository. " +
          "DevLens supports JavaScript and TypeScript files only."
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: PARSE + SAVE FILES
    // ─────────────────────────────────────────────────────────────────────
    console.log(`[pipeline] Step 3 — Parsing ${walkedFiles.length} files`);
    await updateStatus(
      repoId,
      RepositoryStatus.PARSING,
      `Parsing ${walkedFiles.length} files...`
    );

    // Track saved files so we can resolve imports against them in Step 4
    const savedFiles: Array<{
      fileId: string;
      filePath: string;
      parseResult: Awaited<ReturnType<typeof parseFile>>;
    }> = [];

    for (const walkedFile of walkedFiles) {
      try {
        // 3a. Save raw file record to DB
        const file = await prisma.file.create({
          data: {
            repositoryId: repoId,
            filePath: walkedFile.filePath,
            fileName: walkedFile.fileName,
            directory: walkedFile.directory,
            extension: walkedFile.extension,
            sizeBytes: walkedFile.sizeBytes,
            rawContent: walkedFile.rawContent,
            fileType: FileType.UNKNOWN,
            parseStatus: ParseStatus.PENDING,
          },
        });

        // 3b. Parse the file (never throws)
        const parseResult = await parseFile(
          walkedFile.rawContent,
          walkedFile.filePath
        );

        // 3c. Classify the file
        const fileType = classifyFile(
          walkedFile.filePath,
          walkedFile.rawContent,
          parseResult.functions
        );

        // 3d. Save parsed data (imports, exports, functions)
        await prisma.parsedFile.create({
          data: {
            fileId: file.id,
            imports: parseResult.imports as object[],
            exports: parseResult.exports as object[],
            functions: parseResult.functions as object[],
            importCount: parseResult.imports.length,
            exportCount: parseResult.exports.length,
            functionCount: parseResult.functions.length,
            componentCount: parseResult.functions.filter((f) => f.isComponent)
              .length,
          },
        });

        // 3e. Update file with detected type and parse success
        await prisma.file.update({
          where: { id: file.id },
          data: {
            fileType,
            parseStatus: ParseStatus.SUCCESS,
          },
        });

        // 3f. Update repo-level counters
        const updateData: Record<string, unknown> = {
          parsedFiles: { increment: 1 },
          totalFunctions: { increment: parseResult.functions.length },
        };
        if (fileType === FileType.COMPONENT) {
          updateData.totalComponents = { increment: 1 };
        }
        await prisma.repository.update({
          where: { id: repoId },
          data: updateData,
        });

        savedFiles.push({
          fileId: file.id,
          filePath: walkedFile.filePath,
          parseResult,
        });
      } catch (fileErr) {
        // One file failing must NOT stop the whole pipeline
        console.error(
          `[pipeline] Error processing file ${walkedFile.filePath}:`,
          fileErr
        );

        // Try to mark the file as FAILED if it was saved
        try {
          await prisma.file.updateMany({
            where: {
              repositoryId: repoId,
              filePath: walkedFile.filePath,
              parseStatus: ParseStatus.PENDING,
            },
            data: {
              parseStatus: ParseStatus.FAILED,
              parseError:
                fileErr instanceof Error ? fileErr.message : "Unknown error",
            },
          });
          await prisma.repository.update({
            where: { id: repoId },
            data: { failedFiles: { increment: 1 } },
          });
        } catch {
          // Ignore secondary errors
        }
      }
    }

    console.log(
      `[pipeline] ✓ Parsed ${savedFiles.length}/${walkedFiles.length} files`
    );

    // We no longer need the cloned folder on disk — raw content is in DB
    cleanupClone(clonedPath);
    clonedPath = null;

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: RESOLVE IMPORTS → SAVE DEPENDENCY EDGES
    // ─────────────────────────────────────────────────────────────────────
    console.log(`[pipeline] Step 4 — Building dependency graph`);
    await updateStatus(
      repoId,
      RepositoryStatus.GRAPHING,
      "Building dependency graph..."
    );

    const allFilePaths = savedFiles.map((sf) => sf.filePath);

    // Build a quick lookup map: filePath → fileId
    const filePathToId = new Map<string, string>(
      savedFiles.map((sf) => [sf.filePath, sf.fileId])
    );

    for (const savedFile of savedFiles) {
      try {
        const resolvedImports = resolveImports(
          savedFile.parseResult.imports,
          savedFile.filePath,
          allFilePaths
        );

        for (const resolvedImport of resolvedImports) {
          const targetFileId = resolvedImport.resolvedPath
            ? (filePathToId.get(resolvedImport.resolvedPath) ?? null)
            : null;

          const externalPackage = resolvedImport.isExternal
            ? resolvedImport.source.split("/")[0] // "react" from "react/jsx-runtime"
            : null;

          try {
            await prisma.dependency.create({
              data: {
                repositoryId: repoId,
                sourceFileId: savedFile.fileId,
                targetFileId,
                importRaw: resolvedImport.source,
                importResolved: resolvedImport.resolvedPath,
                specifiers: resolvedImport.specifiers,
                isExternal: resolvedImport.isExternal,
                externalPackage,
              },
            });
          } catch (dupErr: unknown) {
            // Unique constraint violation on [sourceFileId, importRaw] — skip
            const errMsg =
              dupErr instanceof Error ? dupErr.message : String(dupErr);
            if (!errMsg.includes("Unique constraint")) {
              console.warn(
                `[pipeline] Dependency save error for ${resolvedImport.source}:`,
                dupErr
              );
            }
          }
        }
      } catch (resolveErr) {
        console.warn(
          `[pipeline] Resolver error for ${savedFile.filePath}:`,
          resolveErr
        );
      }
    }

    console.log(`[pipeline] ✓ Dependency edges saved`);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 5: CALCULATE INSIGHTS
    // ─────────────────────────────────────────────────────────────────────
    console.log(`[pipeline] Step 5 — Calculating insights`);
    await calculateInsights(repoId);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 6: MARK AS READY
    // ─────────────────────────────────────────────────────────────────────
    await prisma.repository.update({
      where: { id: repoId },
      data: {
        status: RepositoryStatus.READY,
        statusMessage: "Analysis complete",
        completedAt: new Date(),
        clonedPath: null,
      },
    });

    console.log(`[pipeline] ═══ ✓ Pipeline complete for ${repoId} ═══\n`);
  } catch (err) {
    console.error(`[pipeline] ✗ Pipeline failed for ${repoId}:`, err);

    // Clean up clone if still on disk
    if (clonedPath) {
      cleanupClone(clonedPath);
    }

    // Mark the repository as FAILED
    try {
      await prisma.repository.update({
        where: { id: repoId },
        data: {
          status: RepositoryStatus.FAILED,
          statusMessage: "Analysis failed",
          errorMessage:
            err instanceof Error ? err.message : "An unknown error occurred",
        },
      });
    } catch (dbErr) {
      console.error(
        `[pipeline] Could not mark repo ${repoId} as FAILED:`,
        dbErr
      );
    }
  }
}
