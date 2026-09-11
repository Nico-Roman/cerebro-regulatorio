import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { legado, responder } from "@/lib/search";
import { db } from "@/lib/db";
import { consultas } from "@/lib/db/schema";
import { iaConfigurada } from "@/lib/ia/proveedor";
import { consumirCupo } from "@/lib/rate-limit";
import { usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";

// Tope por usuario y hora. Alto para un uso humano normal, bajo para un script.
const MAX_BUSQUEDAS_HORA = 60;

// Registro paralelo opcional en n8n → Google Sheets. Postgres es la fuente de
// verdad; esto solo sigue vivo si la variable está puesta.
const LOG_WEBHOOK = process.env.CEREBRO_LOG_WEBHOOK;

// Pasajes que devuelve el motor: una respuesta principal y hasta cinco fuentes
// relacionadas. Un `k` que no sea número entero se ignora en vez de propagar
// NaN: antes `?k=abc` devolvía cero resultados y la consulta no se registraba.
function leerK(valor: string | null): number {
  const n = Number.parseInt(valor ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 10) : 6;
}

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
  const q = (searchParams.get("q") || "").trim().slice(0, 500);
  const k = leerK(searchParams.get("k"));
  const vigente = searchParams.get("vigente") === "1";
  const categoria = searchParams.get("categoria") || undefined;
  const sinOcr = searchParams.get("sin_ocr") === "1";

  if (!q) {
    return NextResponse.json({ error: "consulta_vacia", mensaje: "Escribe una pregunta." }, { status: 400 });
  }

  const respuesta = responder(q, { k, vigente, categoria, sinOcr });
  const resumen = legado(respuesta);

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
      pregunta: q,
      filtros: { vigente, categoria: categoria ?? null, sinOcr },
      k,
      recomendacion: resumen.recomendacion,
      confianza: resumen.confianza,
      coberturaTop: resumen.cobertura_top,
      margen: null,
      conceptosFuera: resumen.conceptos_fuera_del_corpus,
      topCita: resumen.top_cita,
      topScore: null,
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
        estado: respuesta.estado,
        recomendacion: resumen.recomendacion,
        confianza: resumen.confianza,
        top_cita: resumen.top_cita ?? "",
        origen: "web",
      }),
      signal: AbortSignal.timeout(4000),
    }).catch(() => {
      // Registro best-effort: no debe afectar jamás al buscador.
    });
  }

  return NextResponse.json({
    ...respuesta,
    // null cuando la consulta no se pudo registrar: sin fila en `consultas` no
    // hay a qué colgar el voto, y es mejor no mostrar el widget que ofrecer un
    // botón que va a fallar.
    consultaId: consultaRegistrada ? consultaId : null,
    // El botón de redacción con IA solo aparece si la IA está configurada.
    iaDisponible: iaConfigurada(),
  });
}
