// GET  /api/repos/[id]/chat  — return chat history
// POST /api/repos/[id]/chat  — send message, get AI response

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { groq } from "@/lib/groq";
import { MessageRole, RepositoryStatus } from "@prisma/client";

const CHAT_MODEL = "llama-3.3-70b-versatile";

// Stop words excluded from keyword extraction
const STOP_WORDS = new Set([
  "how", "does", "what", "is", "the", "a", "an", "in", "this",
  "where", "are", "do", "i", "can", "me", "about", "which",
  "file", "files", "code", "show", "tell", "explain", "find",
  "and", "or", "my", "its", "it", "that", "to", "of", "for",
  "with", "from", "on", "at", "by", "be", "was", "has", "have",
  "not", "no", "yes", "use", "used", "using", "any", "all",
]);

// ─── GET: Chat history ───────────────────────────────────────────────────────

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

    const messages = await prisma.chatMessage.findMany({
      where: { repositoryId: repoId },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        role: true,
        content: true,
        referencedFiles: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        referencedFiles: m.referencedFiles,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error("[GET /api/repos/[id]/chat]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// ─── POST: Send message ──────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: repoId } = await params;
    const body = await req.json();
    const { message } = body as { message?: string };

    // ── 1. Validate ─────────────────────────────────────────────────────
    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message cannot be empty" },
        { status: 400 }
      );
    }

    // ── 2. Check repo is READY ──────────────────────────────────────────
    const repo = await prisma.repository.findUnique({
      where: { id: repoId },
      select: { id: true, status: true, name: true, fullName: true },
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

    // ── 3. Save user message ────────────────────────────────────────────
    await prisma.chatMessage.create({
      data: {
        repositoryId: repoId,
        role: MessageRole.USER,
        content: message.trim(),
      },
    });

    // ── 4. Find relevant files via keyword matching ─────────────────────

    // Extract meaningful keywords from the question
    const keywords = message
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ""))
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    // Fetch all files (without rawContent first for efficiency)
    const allFiles = await prisma.file.findMany({
      where: { repositoryId: repoId },
      select: { id: true, filePath: true, fileName: true, rawContent: true },
    });

    let relevantFiles: typeof allFiles = [];

    if (keywords.length > 0) {
      // Score each file by keyword presence
      const scored = allFiles.map((f) => {
        const lowerPath = f.filePath.toLowerCase();
        const lowerName = f.fileName.toLowerCase();
        const lowerContent = f.rawContent.toLowerCase();

        let score = 0;
        for (const kw of keywords) {
          if (lowerPath.includes(kw)) score += 3;
          if (lowerName.includes(kw)) score += 2;
          if (lowerContent.includes(kw)) score += 1;
        }
        return { ...f, score };
      });

      relevantFiles = scored
        .filter((f) => f.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
    }

    // Fallback: use the most-imported (highest incomingDeps count) files
    if (relevantFiles.length === 0) {
      const topByImport = await prisma.file.findMany({
        where: { repositoryId: repoId },
        select: { id: true, filePath: true, fileName: true, rawContent: true, _count: { select: { incomingDeps: true } } },
        orderBy: { incomingDeps: { _count: "desc" } },
        take: 3,
      });
      relevantFiles = topByImport;
    }

    // ── 5. Build file context string ────────────────────────────────────
    const fileContexts = relevantFiles
      .map(
        (f) =>
          `FILE: ${f.filePath}\n\`\`\`\n${f.rawContent.slice(0, 2000)}\n\`\`\``
      )
      .join("\n\n---\n\n");

    // ── 6. Get recent chat history for context ──────────────────────────
    const recentHistory = await prisma.chatMessage.findMany({
      where: { repositoryId: repoId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { role: true, content: true },
    });
    const historyMessages = recentHistory.reverse();

    // ── 7. Call Groq ────────────────────────────────────────────────────
    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content:
            "You are an expert code analyst helping developers understand a codebase. " +
            "Answer questions based on the provided file contents. " +
            "Be precise, reference specific file names when relevant, " +
            "and keep answers concise but complete. If you are unsure, say so.",
        },
        ...historyMessages.map((m) => ({
          role: m.role === MessageRole.USER ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
        {
          role: "user" as const,
          content: `RELEVANT FILES:\n\n${fileContexts}\n\nQUESTION: ${message.trim()}`,
        },
      ],
    });

    const groqResponse =
      completion.choices[0]?.message?.content ?? "Sorry, I could not generate a response.";
    const usage = completion.usage;

    // ── 8. Save assistant message ───────────────────────────────────────
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        repositoryId: repoId,
        role: MessageRole.ASSISTANT,
        content: groqResponse,
        referencedFiles: relevantFiles.map((f) => f.filePath),
        model: CHAT_MODEL,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
      },
    });

    return NextResponse.json({
      success: true,
      response: groqResponse,
      referencedFiles: relevantFiles.map((f) => f.filePath),
    });
  } catch (err) {
    console.error("[POST /api/repos/[id]/chat]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
