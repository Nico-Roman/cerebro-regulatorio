import { NextRequest, NextResponse, after } from "next/server";
import { analizar } from "@/lib/search";

export const runtime = "nodejs";

// Cada búsqueda se anota vía webhook n8n en la hoja "Cerebro Regulatorio —
// Preguntas del buscador" (respaldo paralelo en la Data Table cerebro_preguntas).
// Corre con `after()` tras despachar la respuesta: nunca la demora, y si n8n
// está caído la búsqueda no se entera.
const LOG_WEBHOOK =
  process.env.CEREBRO_LOG_WEBHOOK ||
  "https://corima-n8n.ycvq7d.easypanel.host/webhook/cerebro-preguntas-vk83qz";

function registrarPregunta(payload: Record<string, unknown>) {
  after(async () => {
    try {
      await fetch(LOG_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      // Registro best-effort: no debe afectar jamás al buscador.
    }
  });
}

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

  const top = resultados[0];
  registrarPregunta({
    pregunta: q,
    recomendacion: confianza?.recomendacion ?? "",
    confianza: confianza?.confianza ?? "",
    cobertura_top: confianza?.cobertura_top ?? 0,
    margen: confianza?.margen ?? 0,
    conceptos_fuera_del_corpus: confianza?.conceptos_fuera_del_corpus ?? [],
    top_cita: top?.cita ?? "",
    top_score: top?.score ?? 0,
    k,
    filtros: [vigente ? "vigente" : "", categoria ?? "", sinOcr ? "sin_ocr" : ""]
      .filter(Boolean)
      .join(","),
    origen: "web",
  });

  return NextResponse.json({ query: q, confianza, resultados });
}
