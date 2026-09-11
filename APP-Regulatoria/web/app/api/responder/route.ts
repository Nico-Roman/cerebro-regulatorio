// Redacta la respuesta de una consulta ya registrada.
//
// Recibe solo el id de la consulta y vuelve a recuperar los pasajes en el
// servidor. Deliberado: si el navegador pudiera mandar los pasajes, cualquiera
// podría inyectar texto propio en el prompt y hacer que la respuesta "citara"
// una norma inventada.

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { iaConfigurada } from "@/lib/ia/proveedor";
import { redactarRespuesta } from "@/lib/ia/redactar";
import { responder } from "@/lib/search";
import { db } from "@/lib/db";
import { consultas } from "@/lib/db/schema";
import { consumirCupo } from "@/lib/rate-limit";
import { usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";

// Cuota diaria por persona. Los pasajes siguen siendo ilimitados dentro del
// límite normal de búsqueda: lo que se raciona es el gasto en tokens.
const MAX_RESPUESTAS_DIA = 20;

// Cuántos pasajes entran al prompt. Más de seis no mejora la respuesta y
// multiplica el costo por consulta.
const PASAJES_AL_MODELO = 6;

export async function POST(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "sesion_requerida" }, { status: 401 });
  if (!usuario.perfilCompleto) {
    return NextResponse.json({ error: "perfil_incompleto" }, { status: 403 });
  }
  if (!iaConfigurada()) {
    return NextResponse.json({ error: "ia_no_configurada" }, { status: 503 });
  }

  let cuerpo: { consultaId?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const consultaId = typeof cuerpo.consultaId === "string" ? cuerpo.consultaId : "";
  if (!consultaId) return NextResponse.json({ error: "datos_incompletos" }, { status: 400 });

  const [consulta] = await db
    .select()
    .from(consultas)
    .where(and(eq(consultas.id, consultaId), eq(consultas.userId, usuario.id)))
    .limit(1);

  if (!consulta) return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });

  // Si ya se redactó antes, se devuelve lo guardado: repetir la llamada solo
  // gastaría tokens para obtener casi lo mismo (temperatura 0).
  if (consulta.respuestaLlm) {
    return NextResponse.json({
      respuesta: consulta.respuestaLlm,
      modelo: consulta.modelo,
      cacheada: true,
    });
  }

  const cupo = await consumirCupo(`ia:${usuario.id}`, MAX_RESPUESTAS_DIA, 86_400);
  if (!cupo.permitido) {
    return NextResponse.json(
      {
        error: "cuota_diaria",
        mensaje: `Llegaste a las ${MAX_RESPUESTAS_DIA} respuestas redactadas de hoy. Los pasajes siguen disponibles.`,
      },
      { status: 429 }
    );
  }

  const filtros = (consulta.filtros ?? {}) as {
    vigente?: boolean;
    categoria?: string | null;
    sinOcr?: boolean;
  };

  const respuesta = responder(consulta.pregunta, {
    k: PASAJES_AL_MODELO,
    vigente: Boolean(filtros.vigente),
    categoria: filtros.categoria ?? undefined,
    sinOcr: Boolean(filtros.sinOcr),
  });
  const pasajes = (respuesta.principal ? [respuesta.principal] : []).concat(respuesta.relacionadas);

  // Compuerta: si el motor ya concluyó que la materia no está en la base, no se
  // llama al modelo. Ahorra tokens, pero sobre todo evita la respuesta segura
  // de sí misma construida sobre pasajes que no vienen al caso.
  if (respuesta.estado === "ausente" || !pasajes.length) {
    return NextResponse.json({ respuesta: null, ausencia: true, motivo: respuesta.motivo });
  }

  try {
    const salida = await redactarRespuesta(
      consulta.pregunta,
      pasajes.map((r) => ({
        // La cita corta ("DS 3 · art. 217") más el nombre completo de la norma:
        // el modelo la copia tal cual, y así la cita se entiende sola.
        cita: `${r.cita} (${r.norma})`,
        titulo: r.titulo,
        texto: r.texto,
        vigencia: r.avisos.length ? r.avisos.join(" ") : "vigente según el listado oficial del ISP",
      }))
    );

    if (!salida.texto) {
      return NextResponse.json({ error: "respuesta_vacia" }, { status: 502 });
    }

    await db
      .update(consultas)
      .set({
        respuestaLlm: salida.texto,
        modelo: salida.modelo,
        tokensIn: salida.tokensEntrada,
        tokensOut: salida.tokensSalida,
        latenciaMs: salida.latenciaMs,
      })
      .where(eq(consultas.id, consulta.id));

    return NextResponse.json({
      respuesta: salida.texto,
      modelo: salida.modelo,
      latenciaMs: salida.latenciaMs,
      cacheada: false,
    });
  } catch (e) {
    console.error("[ia] falló la redacción:", e);
    return NextResponse.json({ error: "proveedor_no_disponible" }, { status: 502 });
  }
}
