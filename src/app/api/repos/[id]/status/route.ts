// GET /api/repos/[id]/status
// Returns current processing status and progress for polling.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RepositoryStatus } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: repoId } = await params;

    const repo = await prisma.repository.findUnique({
      where: { id: repoId },
      select: {
        id: true,
        status: true,
        statusMessage: true,
        totalFiles: true,
        parsedFiles: true,
        failedFiles: true,
        totalComponents: true,
        totalFunctions: true,
        totalEdges: true,
        errorMessage: true,
        completedAt: true,
      },
    });

    if (!repo) {
      return NextResponse.json(
        { success: false, error: "Repository not found" },
        { status: 404 }
      );
    }

    const percentage =
      repo.totalFiles > 0
        ? Math.round((repo.parsedFiles / repo.totalFiles) * 100)
        : 0;

    const isReady = repo.status === RepositoryStatus.READY;
    const isFailed = repo.status === RepositoryStatus.FAILED;

    return NextResponse.json({
      success: true,
      status: repo.status,
      statusMessage: repo.statusMessage,
      progress: {
        totalFiles: repo.totalFiles,
        parsedFiles: repo.parsedFiles,
        failedFiles: repo.failedFiles,
        percentage,
      },
      stats: isReady
        ? {
            totalFiles: repo.totalFiles,
            totalComponents: repo.totalComponents,
            totalFunctions: repo.totalFunctions,
            totalEdges: repo.totalEdges,
          }
        : null,
      error: repo.errorMessage ?? null,
      ready: isReady,
      failed: isFailed,
    });
  } catch (err) {
    console.error("[GET /api/repos/[id]/status]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
