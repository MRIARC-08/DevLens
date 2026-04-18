import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const repos = await prisma.repository.findMany({
      orderBy: { createdAt: "desc" },
      // Limit to 50 for performance if needed, but the user wants "show all the projects"
      take: 50, 
    });

    return NextResponse.json({ success: true, count: repos.length, repos });
  } catch (err) {
    console.error("[GET /api/repos]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
