// GET /api/repos/[id]/files
// Returns the file tree + flat list for the left sidebar.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Tree builder ─────────────────────────────────────────────────────────────

type TreeNode =
  | { _type: "directory"; children: Record<string, TreeNode> }
  | {
      _type: "file";
      id: string;
      filePath: string;
      fileType: string;
      sizeBytes: number;
      functionCount: number;
    };

function buildTree(
  files: Array<{
    id: string;
    filePath: string;
    fileType: string;
    sizeBytes: number;
    parsedData: { functionCount: number } | null;
  }>
): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};

  for (const file of files) {
    const parts = file.filePath.split("/");
    let current: Record<string, TreeNode> = root;

    // Walk through all directory parts
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { _type: "directory", children: {} };
      }
      const node = current[part];
      if (node._type === "directory") {
        current = node.children;
      }
    }

    // Place the file at the leaf
    const fileName = parts[parts.length - 1];
    current[fileName] = {
      _type: "file",
      id: file.id,
      filePath: file.filePath,
      fileType: file.fileType,
      sizeBytes: file.sizeBytes,
      functionCount: file.parsedData?.functionCount ?? 0,
    };
  }

  return root;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: repoId } = await params;

    const repo = await prisma.repository.findUnique({
      where: { id: repoId },
      select: { id: true },
    });

    if (!repo) {
      return NextResponse.json(
        { success: false, error: "Repository not found" },
        { status: 404 }
      );
    }

    const files = await prisma.file.findMany({
      where: { repositoryId: repoId },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        fileType: true,
        directory: true,
        sizeBytes: true,
        parseStatus: true,
        parsedData: {
          select: { functionCount: true },
        },
      },
      orderBy: { filePath: "asc" },
    });

    const tree = buildTree(files);

    const flatList = files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      filePath: f.filePath,
      fileType: f.fileType,
      directory: f.directory,
      sizeBytes: f.sizeBytes,
      parseStatus: f.parseStatus,
      functionCount: f.parsedData?.functionCount ?? 0,
    }));

    return NextResponse.json({ success: true, tree, flatList });
  } catch (err) {
    console.error("[GET /api/repos/[id]/files]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
