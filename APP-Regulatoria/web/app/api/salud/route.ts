import { NextResponse } from "next/server";
import { loadCorpus } from "@/lib/search";
import { estadoCorpus } from "@/lib/estado-corpus";
import { iaDisponible } from "@/lib/ia/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Latido público para el vigía de GitHub Actions (encargo E): ¿el sitio
// responde, con corpus cargado, y la IA está configurada?
//
// Sin datos sensibles a propósito: ni modelo, ni proveedor, ni conteos de uso.
// Para el diagnóstico completo está /api/estado. Responde 503 solo si el corpus
// no se pudo cargar: un sitio sin corpus está caído aunque la página abra.
export async function GET() {
  let chunks = 0;
  try {
    chunks = loadCorpus().length;
  } catch {
    chunks = 0;
  }
  const estado = estadoCorpus();
  const ia = await iaDisponible().catch(() => false);
  return NextResponse.json(
    { ok: chunks > 0, corpus_generado: estado.generado, ia_configurada: ia, ts: new Date().toISOString() },
    { status: chunks > 0 ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
