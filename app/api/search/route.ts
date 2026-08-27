import { NextRequest, NextResponse } from "next/server";
import { analizar } from "@/lib/search";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const k = Number(searchParams.get("k") || "8");
  const vigente = searchParams.get("vigente") === "1";
  const categoria = searchParams.get("categoria") || undefined;
  const sinOcr = searchParams.get("sin_ocr") === "1";

  if (!q) {
    return NextResponse.json({ query: q, resultados: [], confianza: null });
  }

  // `confianza` viaja junto a los resultados para que la interfaz pueda decir
  // "esto no está en el corpus" en vez de mostrar los k pasajes más cercanos
  // como si respondieran.
  const { resultados, confianza } = analizar(q, {
    k: Math.min(Math.max(k, 1), 20),
    vigente,
    categoria,
    sinOcr,
  });
  return NextResponse.json({ query: q, confianza, resultados });
}
