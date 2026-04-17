// GET /api/files/[id]
// Returns full file detail: parsed data, imports, importedBy, explanation cache.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fileId } = await params;

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        parsedData: true,
        explanation: {
          select: { explanation: true, model: true, createdAt: true },
        },
        // Files this file imports from (outgoing edges)
        outgoingDeps: {
          where: { isExternal: false, targetFileId: { not: null } },
          include: {
            targetFile: {
              select: {
                id: true,
                fileName: true,
                filePath: true,
                fileType: true,
              },
            },
          },
        },
        // Files that import this file (incoming edges)
        incomingDeps: {
          where: { isExternal: false },
          include: {
            sourceFile: {
              select: {
                id: true,
                fileName: true,
                filePath: true,
                fileType: true,
              },
            },
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      file: {
        id: file.id,
        fileName: file.fileName,
        filePath: file.filePath,
        fileType: file.fileType,
        directory: file.directory,
        extension: file.extension,
        sizeBytes: file.sizeBytes,
        rawContent: file.rawContent,
        parseStatus: file.parseStatus,

        parsedData: file.parsedData
          ? {
              imports: file.parsedData.imports,
              exports: file.parsedData.exports,
              functions: file.parsedData.functions,
              importCount: file.parsedData.importCount,
              exportCount: file.parsedData.exportCount,
              functionCount: file.parsedData.functionCount,
              componentCount: file.parsedData.componentCount,
            }
          : null,

        // Internal files this file imports
        imports: file.outgoingDeps
          .filter((d) => d.targetFile !== null)
          .map((d) => ({
            id: d.targetFile!.id,
            fileName: d.targetFile!.fileName,
            filePath: d.targetFile!.filePath,
            fileType: d.targetFile!.fileType,
            importRaw: d.importRaw,
            specifiers: d.specifiers,
          })),

        // Files that import this file
        importedBy: file.incomingDeps.map((d) => ({
          id: d.sourceFile.id,
          fileName: d.sourceFile.fileName,
          filePath: d.sourceFile.filePath,
          fileType: d.sourceFile.fileType,
          importRaw: d.importRaw,
        })),

        explanation: file.explanation?.explanation ?? null,
      },
    });
  } catch (err) {
    console.error("[GET /api/files/[id]]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
