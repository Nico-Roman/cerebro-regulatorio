import { NextResponse } from "next/server";
import { loadCorpus } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Healthcheck de Railway. Responde 200 solo cuando el corpus está cargado en
// memoria: un contenedor que levanta sin índice sirve la web pero no puede
// buscar nada, y eso no debe pasar por sano ni recibir tráfico.
export async function GET() {
  try {
    const corpus = loadCorpus();
    if (!corpus.length) {
      return NextResponse.json(
        { ok: false, motivo: "corpus vacío" },
        { status: 503 }
      );
    }
    return NextResponse.json({
      ok: true,
      chunks: corpus.length,
      ts: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, motivo: "no se pudo leer el corpus" },
      { status: 503 }
    );
  }
}
