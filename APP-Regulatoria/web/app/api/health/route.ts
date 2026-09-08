import { NextResponse } from "next/server";
import { loadCorpus } from "@/lib/search";
import { estadoCorpus } from "@/lib/estado-corpus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Healthcheck de Railway: ¿este contenedor puede servir tráfico?
//
// Responde 200 solo cuando el corpus está cargado en memoria: un contenedor
// que levanta sin índice sirve la web pero no puede buscar nada, y eso no debe
// pasar por sano ni recibir tráfico.
//
// Lo que este endpoint NO hace es opinar sobre la EDAD del corpus. Antes eso
// era un hueco —un corpus de hace tres meses pasaba este check igual de
// contento— y por eso el pipeline pudo estar 8 días caído sin que nada
// chillara. Ese trabajo ahora es de /api/estado, que sí devuelve 503 cuando
// los datos envejecen. Están separados a propósito: tumbar el sitio por tener
// normativa con atraso sería un remedio peor que la enfermedad.
//
// La fecha se incluye igual en la respuesta, para poder diagnosticar de una
// sola mirada sin cambiar el código de estado.
export async function GET() {
  try {
    const corpus = loadCorpus();
    if (!corpus.length) {
      return NextResponse.json({ ok: false, motivo: "corpus vacío" }, { status: 503 });
    }
    const estado = estadoCorpus();
    return NextResponse.json({
      ok: true,
      chunks: corpus.length,
      corpus_generado: estado.generado,
      dias_desde_generacion: estado.diasDesdeGeneracion,
      // Ojo: fresco:false NO baja el código a 503 acá. Ver /api/estado.
      fresco: estado.fresco,
      ts: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, motivo: "no se pudo leer el corpus" }, { status: 503 });
  }
}
