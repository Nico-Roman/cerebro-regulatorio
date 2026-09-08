import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { analizar } from "@/lib/search";
import { db } from "@/lib/db";
import { consultas } from "@/lib/db/schema";
import { consumirCupo } from "@/lib/rate-limit";
import { usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";

// Tope por usuario y hora. Alto para un uso humano normal, bajo para un script.
const MAX_BUSQUEDAS_HORA = 60;

// Registro paralelo opcional en n8n → Google Sheets. Postgres es la fuente de
// verdad; esto solo sigue vivo si la variable está puesta.
const LOG_WEBHOOK = process.env.CEREBRO_LOG_WEBHOOK;

export async function GET(req: NextRequest) {
  // La redirección del proxy no protege esta ruta: acá se valida la sesión
  // contra la base de datos, que es lo único que un cliente no puede falsificar.
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json(
      { error: "sesion_requerida", mensaje: "Entra con tu cuenta para buscar." },
      { status: 401 }
    );
  }
  if (!usuario.perfilCompleto) {
    return NextResponse.json(
      { error: "perfil_incompleto", mensaje: "Completa tu perfil para buscar." },
      { status: 403 }
    );
  }

  const cupo = await consumirCupo(`buscar:${usuario.id}`, MAX_BUSQUEDAS_HORA, 3600);
  if (!cupo.permitido) {
    return NextResponse.json(
      {
        error: "limite_alcanzado",
        mensaje: "Alcanzaste el límite de búsquedas por hora. Intenta más tarde.",
      },
      { status: 429, headers: { "Retry-After": String(cupo.reinicioEn) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const k = Number(searchParams.get("k") || "8");
  const vigente = searchParams.get("vigente") === "1";
  const categoria = searchParams.get("categoria") || undefined;
  const sinOcr = searchParams.get("sin_ocr") === "1";

  if (!q) {
    return NextResponse.json({ query: q, resultados: [], confianza: null });
  }

  const { resultados, confianza } = analizar(q, {
    k: Math.min(Math.max(k, 1), 20),
    vigente,
    categoria,
    sinOcr,
  });

  const top = resultados[0];

  // El id se genera acá y viaja en la respuesta: es lo que le permite al
  // navegador votar sobre ESTA búsqueda (tabla feedback) sin exponer nada más.
  const consultaId = randomUUID();
  let consultaRegistrada = false;

  // El registro no debe poder tumbar una búsqueda que ya salió bien: si falla
  // la escritura, se anota en el log del servidor y la respuesta sigue.
  try {
    await db.insert(consultas).values({
      id: consultaId,
      userId: usuario.id,
      pregunta: q.slice(0, 2000),
      filtros: {
        vigente,
        categoria: categoria ?? null,
        sinOcr,
      },
      k,
      recomendacion: confianza?.recomendacion ?? null,
      confianza: confianza?.confianza ?? null,
      coberturaTop: confianza?.cobertura_top ?? null,
      margen: confianza?.margen ?? null,
      conceptosFuera: confianza?.conceptos_fuera_del_corpus ?? [],
      topCita: top?.cita ?? null,
      topScore: top?.score ?? null,
    });
    consultaRegistrada = true;
  } catch (e) {
    console.error("[search] no se pudo registrar la consulta:", e);
  }

  if (LOG_WEBHOOK) {
    void fetch(LOG_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pregunta: q,
        usuario_email: usuario.email,
        recomendacion: confianza?.recomendacion ?? "",
        confianza: confianza?.confianza ?? "",
        top_cita: top?.cita ?? "",
        origen: "web",
      }),
      signal: AbortSignal.timeout(4000),
    }).catch(() => {
      // Registro best-effort: no debe afectar jamás al buscador.
    });
  }

  return NextResponse.json({
    query: q,
    confianza,
    resultados,
    // null cuando la consulta no se pudo registrar: sin fila en `consultas` no
    // hay a qué colgar el voto, y es mejor no mostrar el widget que ofrecer un
    // botón que va a fallar.
    consultaId: consultaRegistrada ? consultaId : null,
  });
}
