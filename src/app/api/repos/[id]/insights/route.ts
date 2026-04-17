// GET /api/repos/[id]/insights
// Returns graph metrics and codebase stats for the insights panel.

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
        status: true,
        insights: true,
        totalFiles: true,
        totalComponents: true,
        totalFunctions: true,
        totalEdges: true,
      },
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

    return NextResponse.json({
      success: true,
      insights: repo.insights,
      summary: {
        totalFiles: repo.totalFiles,
        totalComponents: repo.totalComponents,
        totalFunctions: repo.totalFunctions,
        totalEdges: repo.totalEdges,
      },
    });
  } catch (err) {
    console.error("[GET /api/repos/[id]/insights]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
