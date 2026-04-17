// POST /api/files/[id]/explain
// Returns (or generates) an AI explanation for a file.
// Checks the cache first — only calls Groq on a cache miss.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { groq } from "@/lib/groq";

const EXPLAIN_MODEL = "llama-3.3-70b-versatile";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fileId } = await params;

    // ── 1. Check explanation cache ──────────────────────────────────────
    const cached = await prisma.fileExplanation.findUnique({
      where: { fileId },
    });

    if (cached) {
      return NextResponse.json({
        success: true,
        explanation: cached.explanation,
        cached: true,
        model: cached.model,
      });
    }

    // ── 2. Fetch file + dependency context ──────────────────────────────
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        parsedData: {
          select: { functions: true, importCount: true, functionCount: true },
        },
        // What this file imports
        outgoingDeps: {
          where: { isExternal: false, targetFileId: { not: null } },
          include: {
            targetFile: { select: { fileName: true, filePath: true } },
          },
        },
        // What imports this file
        incomingDeps: {
          where: { isExternal: false },
          include: {
            sourceFile: { select: { fileName: true, filePath: true } },
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

    // ── 3. Build prompt ─────────────────────────────────────────────────
    const importsText =
      file.outgoingDeps.length > 0
        ? file.outgoingDeps
            .filter((d) => d.targetFile)
            .map((d) => `- ${d.targetFile!.filePath}`)
            .join("\n")
        : "No internal dependencies";

    const importedByText =
      file.incomingDeps.length > 0
        ? file.incomingDeps.map((d) => `- ${d.sourceFile.filePath}`).join("\n")
        : "Not imported by any file";

    const prompt = `You are an expert code analyst.

Analyze this file from a codebase and explain it clearly.

FILE: ${file.filePath}
TYPE: ${file.fileType}

THIS FILE IMPORTS FROM:
${importsText}

THIS FILE IS IMPORTED BY:
${importedByText}

SOURCE CODE:
\`\`\`${file.extension}
${file.rawContent.slice(0, 6000)}
\`\`\`

Explain in plain English:
1. What is the purpose of this file?
2. What is its responsibility in the codebase?
3. How does it relate to files that import it?
4. What are the key functions or components defined here?

Be concise. Maximum 200 words. No bullet points, just clear paragraphs.`;

    // ── 4. Call Groq ────────────────────────────────────────────────────
    const completion = await groq.chat.completions.create({
      model: EXPLAIN_MODEL,
      temperature: 0.3,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const groqResponse =
      completion.choices[0]?.message?.content ??
      "Could not generate an explanation.";
    const usage = completion.usage;

    // ── 5. Save to cache ────────────────────────────────────────────────
    await prisma.fileExplanation.create({
      data: {
        fileId,
        explanation: groqResponse,
        model: EXPLAIN_MODEL,
        prompt,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
      },
    });

    return NextResponse.json({
      success: true,
      explanation: groqResponse,
      cached: false,
      model: EXPLAIN_MODEL,
    });
  } catch (err) {
    console.error("[POST /api/files/[id]/explain]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
