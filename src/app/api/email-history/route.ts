import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const [records, total] = await Promise.all([
      db.emailRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.emailRecord.count(),
    ]);

    return NextResponse.json({ records, total });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}