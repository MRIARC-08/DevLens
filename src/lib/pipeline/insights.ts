// src/lib/pipeline/insights.ts
// Step 6: Calculate graph-level metrics after all files and dependencies are saved to DB.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface FileRef {
  id: string;
  fileName: string;
  filePath: string;
}

// ─── Cycle Detection (DFS) ────────────────────────────────────────────────────

/**
 * Detect cycles in a directed graph using DFS with recursion stack tracking.
 * Returns true if at least one cycle exists.
 *
 * @param graph  Adjacency list: Map<sourceFileId, targetFileId[]>
 */
function detectCycles(graph: Map<string, string[]>): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        // Back edge found → cycle
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (dfs(node)) return true;
    }
  }

  return false;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Calculate graph-level metrics for a repository and update the database.
 * Runs after all files, parsed data, and dependencies have been saved.
 *
 * @param repoId  Repository ID
 */
export async function calculateInsights(repoId: string): Promise<void> {
  console.log(`[insights] Calculating metrics for repo ${repoId}`);

  try {
    // ── 1. Fetch all files ────────────────────────────────────────────────
    const files = await prisma.file.findMany({
      where: { repositoryId: repoId },
      select: { id: true, fileName: true, filePath: true, fileType: true },
    });

    // ── 2. Fetch all internal dependencies ───────────────────────────────
    const deps = await prisma.dependency.findMany({
      where: {
        repositoryId: repoId,
        isExternal: false,
        targetFileId: { not: null },
      },
      select: { sourceFileId: true, targetFileId: true },
    });

    const totalEdges = await prisma.dependency.count({
      where: { repositoryId: repoId },
    });

    // ── 3. Build adjacency structures ────────────────────────────────────

    // incomingCount[fileId] = number of files that import it
    const incomingCount = new Map<string, number>();
    // outgoingCount[fileId] = number of files it imports
    const outgoingCount = new Map<string, number>();
    // graph for cycle detection
    const graph = new Map<string, string[]>();

    for (const file of files) {
      incomingCount.set(file.id, 0);
      outgoingCount.set(file.id, 0);
      graph.set(file.id, []);
    }

    for (const dep of deps) {
      if (!dep.targetFileId) continue;

      // incoming edges for target
      incomingCount.set(dep.targetFileId, (incomingCount.get(dep.targetFileId) ?? 0) + 1);
      // outgoing edges for source
      outgoingCount.set(dep.sourceFileId, (outgoingCount.get(dep.sourceFileId) ?? 0) + 1);
      // graph edge
      const existing = graph.get(dep.sourceFileId) ?? [];
      existing.push(dep.targetFileId);
      graph.set(dep.sourceFileId, existing);
    }

    // ── 4. Most imported file ─────────────────────────────────────────────
    let mostImportedFile: (FileRef & { importedByCount: number }) | null = null;
    let maxIncoming = 0;

    for (const file of files) {
      const count = incomingCount.get(file.id) ?? 0;
      if (count > maxIncoming) {
        maxIncoming = count;
        mostImportedFile = {
          id: file.id,
          fileName: file.fileName,
          filePath: file.filePath,
          importedByCount: count,
        };
      }
    }

    // ── 5. Entry points ───────────────────────────────────────────────────
    // No incoming internal deps, but has at least one outgoing dep
    const entryPoints: FileRef[] = files
      .filter(
        (f) =>
          (incomingCount.get(f.id) ?? 0) === 0 &&
          (outgoingCount.get(f.id) ?? 0) > 0
      )
      .map((f) => ({ id: f.id, fileName: f.fileName, filePath: f.filePath }))
      .slice(0, 10); // cap to keep JSON small

    // ── 6. Isolated files ─────────────────────────────────────────────────
    // No incoming AND no outgoing internal deps
    const isolatedFiles: FileRef[] = files
      .filter(
        (f) =>
          (incomingCount.get(f.id) ?? 0) === 0 &&
          (outgoingCount.get(f.id) ?? 0) === 0
      )
      .map((f) => ({ id: f.id, fileName: f.fileName, filePath: f.filePath }));

    // ── 7. Cycle detection ────────────────────────────────────────────────
    const hasCycles = detectCycles(graph);

    // ── 8. File type breakdown ────────────────────────────────────────────
    const fileTypeBreakdown: Record<string, number> = {};
    for (const file of files) {
      const t = file.fileType as string;
      fileTypeBreakdown[t] = (fileTypeBreakdown[t] ?? 0) + 1;
    }

    // ── 9. Average imports per file ───────────────────────────────────────
    const totalInternalEdges = deps.length;
    const avgImportsPerFile =
      files.length > 0
        ? Math.round((totalInternalEdges / files.length) * 10) / 10
        : 0;

    // ── 10. Most connected files (top 5 by total degree) ─────────────────
    const mostConnectedFiles = files
      .map((f) => ({
        fileName: f.fileName,
        filePath: f.filePath,
        totalConnections:
          (incomingCount.get(f.id) ?? 0) + (outgoingCount.get(f.id) ?? 0),
      }))
      .sort((a, b) => b.totalConnections - a.totalConnections)
      .slice(0, 5);

    // ── 11. Persist insights to DB ────────────────────────────────────────
    const insights = {
      mostImportedFile,
      entryPoints,
      isolatedFiles,
      hasCycles,
      fileTypeBreakdown,
      avgImportsPerFile,
      mostConnectedFiles,
      totalFiles: files.length,
      totalEdges,
    };

    await prisma.repository.update({
      where: { id: repoId },
      data: {
        // Cast to Prisma.InputJsonValue — required for Json fields with typed objects
        insights: insights as unknown as Prisma.InputJsonValue,
        totalEdges,
      },
    });

    console.log(
      `[insights] ✓ Done — hasCycles=${hasCycles}, mostImported=${mostImportedFile?.filePath ?? "none"}`
    );
  } catch (err) {
    console.error(`[insights] Error calculating insights for ${repoId}:`, err);
    // Non-fatal — pipeline can still mark as READY without insights
  }
}
