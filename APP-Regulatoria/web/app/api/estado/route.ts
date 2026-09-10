import { NextResponse } from "next/server";
import { loadCorpus } from "@/lib/search";
import { DIAS_VENCIDO, estadoCorpus } from "@/lib/estado-corpus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estado de los DATOS, no del contenedor.
//
// Deliberadamente separado de /api/health, y la distinción importa:
//
//   /api/health  → ¿este contenedor puede servir? Lo consulta Railway para
//                  decidir si le manda tráfico. Si devolviera 503 por corpus
//                  viejo, Railway sacaría de circulación un servicio que
//                  funciona perfecto, y quedarse sin sitio es peor que servir
//                  normativa con atraso.
//
//   /api/estado  → ¿los datos están al día? Lo consulta el monitor externo
//                  (UptimeRobot / Better Stack). Este SÍ devuelve 503 cuando
//                  el corpus lleva más de una semana sin actualizarse, porque
//                  ese es justamente el evento que nadie estaba viendo: el
//                  pipeline estuvo 8 días caído con todo en verde.
//
// Regla de fondo: nada puede reportar salud sin reportar frescura, y la
// ausencia de una señal tiene que ser ella misma una alarma.
export async function GET() {
  const estado = estadoCorpus();

  let chunks = 0;
  try {
    chunks = loadCorpus().length;
  } catch {
    chunks = 0;
  }

  const cuerpo = {
    ok: !estado.vencido && chunks > 0,
    corpus: {
      generado: estado.generado,
      dias_desde_generacion: estado.diasDesdeGeneracion,
      fresco: estado.fresco,
      vencido: estado.vencido,
      umbral_vencido_dias: DIAS_VENCIDO,
      documentos: estado.documentos,
      normas_listado_oficial: estado.normasListadoOficial,
      publicado_por: estado.publicadoPor,
      chunks,
    },
    // Las leyes de rango superior tienen su propia frescura: la BCN publica un
    // texto refundido con fecha de versión, y esa fecha es lo que dice si el
    // Código Sanitario que se está sirviendo es el vigente.
    codigo_sanitario: {
      version_refundida: estado.codigoSanitarioVersion,
      fuente: "https://www.bcn.cl/leychile/navegar?idNorma=5595",
    },
    motivo: estado.vencido
      ? estado.generado
        ? `El corpus se generó hace ${estado.diasDesdeGeneracion} días. El pipeline diario no está corriendo.`
        : "El corpus no declara fecha de generación: no se puede afirmar que esté al día."
      : chunks === 0
        ? "El corpus no se pudo cargar en memoria."
        : null,
    ts: new Date().toISOString(),
  };

  return NextResponse.json(cuerpo, { status: cuerpo.ok ? 200 : 503 });
}
