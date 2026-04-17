// POST /api/repos/analyze
// Accepts a GitHub URL, creates a repo record, fires the pipeline.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processRepository } from "@/lib/pipeline";
import { RepositoryStatus } from "@prisma/client";

const GITHUB_URL_RE = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body as { url?: string };

    // ── 1. Validate input ──────────────────────────────────────────────
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400 }
      );
    }

    const match = url.trim().match(GITHUB_URL_RE);
    if (!match) {
      return NextResponse.json(
        { success: false, error: "Invalid GitHub URL" },
        { status: 400 }
      );
    }

    const [, owner, name] = match;
    const fullName = `${owner}/${name}`;

    // Normalise URL — strip trailing slashes and .git suffix
    const cleanUrl = url
      .trim()
      .replace(/\.git$/, "")
      .replace(/\/$/, "");

    // ── 2. Return existing READY repo for the same URL ─────────────────
    const existing = await prisma.repository.findFirst({
      where: { url: cleanUrl, status: RepositoryStatus.READY },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        repoId: existing.id,
        alreadyExists: true,
      });
    }

    // ── 3. Create a new repository record ─────────────────────────────
    const repo = await prisma.repository.create({
      data: {
        url: cleanUrl,
        owner,
        name,
        fullName,
        status: RepositoryStatus.PENDING,
        statusMessage: "Queued...",
      },
    });

    // ── 4. Fire and forget — pipeline updates DB itself ────────────────
    processRepository(repo.id).catch(console.error);

    return NextResponse.json({
      success: true,
      repoId: repo.id,
      alreadyExists: false,
    });
  } catch (err) {
    console.error("[POST /api/repos/analyze]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
