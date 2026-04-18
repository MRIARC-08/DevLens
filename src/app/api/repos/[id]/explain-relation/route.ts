import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { groq } from "@/lib/groq";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: repoId } = await params;
    const { sourcePath, targetPath, importRaw } = await req.json();

    if (!sourcePath || !targetPath) {
      return NextResponse.json({ success: false, error: "Missing source/target" }, { status: 400 });
    }

    // Fetch both files content for context
    const files = await prisma.file.findMany({
      where: {
        repositoryId: repoId,
        filePath: { in: [sourcePath, targetPath] },
      },
      select: { filePath: true, rawContent: true },
    });

    const sourceFile = files.find(f => f.filePath === sourcePath);
    const targetFile = files.find(f => f.filePath === targetPath);

    if (!sourceFile || !targetFile) {
       return NextResponse.json({ success: false, error: "Files not found" }, { status: 404 });
    }

    const prompt = `
Explain the relationship between these two files in the context of the repository.
Source File: ${sourcePath}
Target File: ${targetPath}
Import Statement: ${importRaw}

Context:
Source Content (Partial):
${sourceFile.rawContent.slice(0, 1500)}

Target Content (Partial):
${targetFile.rawContent.slice(0, 1500)}

Please explain:
1. Why does ${sourcePath} import ${targetPath}?
2. What is the impact of this relationship on the directory structure or the overall application logic in that specific context?
3. Is this a tight or loose coupling based on what is being imported?

Keep the explanation professional, concise (max 3-4 paragraphs), and insightful.
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 1000,
      messages: [
        { role: "system", content: "You are a senior software architect specializing in dependency analysis." },
        { role: "user", content: prompt }
      ],
    });

    return NextResponse.json({
      success: true,
      explanation: completion.choices[0]?.message?.content ?? "No explanation generated."
    });

  } catch (err) {
    console.error("[POST /api/repos/[id]/explain-relation]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
