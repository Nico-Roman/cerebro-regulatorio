import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/search";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const k = Number(searchParams.get("k") || "8");
  const vigente = searchParams.get("vigente") === "1";
  const categoria = searchParams.get("categoria") || undefined;

  if (!q) {
    return NextResponse.json({ query: q, resultados: [] });
  }

  const resultados = search(q, { k: Math.min(Math.max(k, 1), 20), vigente, categoria });
  return NextResponse.json({ query: q, resultados });
}
