// GET /api/repos/[id]/graph
// Returns nodes + edges formatted for React Flow.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RepositoryStatus } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: repoId } = await params;

    // ── 1. Validate repo exists and is ready ──────────────────────────
    const repo = await prisma.repository.findUnique({
      where: { id: repoId },
      select: { id: true, status: true },
    });

    if (!repo) {
      return NextResponse.json(
        { success: false, error: "Repository not found" },
        { status: 404 }
      );
    }

    if (repo.status !== RepositoryStatus.READY) {
      return NextResponse.json(
        { success: false, error: "Repository is not ready yet" },
        { status: 400 }
      );
    }

    // ── 2. Query files with parsed metadata + incoming dep count ───────
    const files = await prisma.file.findMany({
      where: { repositoryId: repoId },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        fileType: true,
        parseStatus: true,
        parsedData: {
          select: {
            functionCount: true,
            componentCount: true,
            importCount: true,
          },
        },
        _count: {
          select: {
            incomingDeps: {
              where: { isExternal: false },
            },
          },
        },
      },
    });

    // ── 3. Query internal dependency edges ─────────────────────────────
    const dependencies = await prisma.dependency.findMany({
      where: {
        repositoryId: repoId,
        isExternal: false,
        targetFileId: { not: null },
      },
      select: {
        id: true,
        sourceFileId: true,
        targetFileId: true,
        importRaw: true,
      },
    });

    // ── 4. Format for React Flow ───────────────────────────────────────
    const nodes = files.map((file) => ({
      id: file.id,
      type: "fileNode",
      position: { x: 0, y: 0 }, // layout handled by dagre on the client
      data: {
        label: file.fileName,
        filePath: file.filePath,
        fileType: file.fileType,
        functionCount: file.parsedData?.functionCount ?? 0,
        importCount: file.parsedData?.importCount ?? 0,
        importedByCount: file._count.incomingDeps,
        parseStatus: file.parseStatus,
      },
    }));

    const edges = dependencies.map((dep) => ({
      id: dep.id,
      source: dep.sourceFileId,
      target: dep.targetFileId as string,
      animated: false,
      data: { importRaw: dep.importRaw },
    }));

    return NextResponse.json({ success: true, nodes, edges });
  } catch (err) {
    console.error("[GET /api/repos/[id]/graph]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
