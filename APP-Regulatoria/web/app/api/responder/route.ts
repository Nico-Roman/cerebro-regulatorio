// Redacta la respuesta de una consulta ya registrada.
//
// Recibe solo el id de la consulta y vuelve a recuperar los pasajes en el
// servidor. Deliberado: si el navegador pudiera mandar los pasajes, cualquiera
// podría inyectar texto propio en el prompt y hacer que la respuesta "citara"
// una norma inventada.

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { ErrorProveedor, iaConfigurada, modeloActual } from "@/lib/ia/proveedor";
import {
  claveCache,
  esAbstencion,
  pasajesDesdeRespuesta,
  redactarRespuesta,
  type FuenteCitada,
} from "@/lib/ia/redactar";
import { responder } from "@/lib/search";
import { db } from "@/lib/db";
import { consultas } from "@/lib/db/schema";
import { consumirCupo } from "@/lib/rate-limit";
import { usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";

// Cuota diaria por persona. Los pasajes siguen siendo ilimitados dentro del
// límite normal de búsqueda: lo que se raciona es el gasto en tokens. Una
// respuesta servida desde la caché no descuenta cuota.
const MAX_RESPUESTAS_DIA = Number.parseInt(process.env.LLM_CUOTA_DIARIA ?? "", 10) || 20;

// Cuántos pasajes entran al prompt. Más de seis no mejora la respuesta y
// multiplica el costo por consulta.
const PASAJES_AL_MODELO = 6;

function cuerpoRespuesta(p: {
  texto: string;
  fuentes: FuenteCitada[];
  modelo: string | null;
  cacheada: boolean;
}) {
  // La verificación se rehace sobre el texto ya resuelto: una cita inválida
  // quedó escrita como "cita no verificable" y se vuelve a detectar acá.
  const abstuvo = esAbstencion(p.texto);
  return {
    respuesta: p.texto,
    fuentes: p.fuentes,
    modelo: p.modelo,
    cacheada: p.cacheada,
    abstuvo,
    citasInvalidas: /cita no verificable/.test(p.texto),
    sinCitas: !abstuvo && !p.fuentes.length,
  };
}

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
    return NextResponse.json(
      cuerpoRespuesta({
        texto: consulta.respuestaLlm,
        fuentes: (consulta.fuentesLlm ?? []) as FuenteCitada[],
        modelo: consulta.modelo,
        cacheada: true,
      })
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
  const pasajes = pasajesDesdeRespuesta(respuesta);

  // Compuerta: si el motor ya concluyó que la materia no está en la base, no se
  // llama al modelo. Ahorra tokens, pero sobre todo evita la respuesta segura
  // de sí misma construida sobre pasajes que no vienen al caso.
  if (respuesta.estado === "ausente" || !pasajes.length) {
    return NextResponse.json({ respuesta: null, ausencia: true, motivo: respuesta.motivo });
  }

  // Caché compartida: otra persona ya hizo esta pregunta y el motor le entregó
  // exactamente los mismos pasajes. No descuenta cuota ni llama al modelo.
  const clave = claveCache(consulta.pregunta, pasajes, modeloActual());
  const [previa] = await db
    .select({ texto: consultas.respuestaLlm, fuentes: consultas.fuentesLlm, modelo: consultas.modelo })
    .from(consultas)
    .where(and(eq(consultas.claveIa, clave), isNotNull(consultas.respuestaLlm)))
    .limit(1);

  if (previa?.texto) {
    await db
      .update(consultas)
      .set({
        respuestaLlm: previa.texto,
        fuentesLlm: previa.fuentes,
        modelo: previa.modelo,
        claveIa: clave,
        tokensIn: 0,
        tokensOut: 0,
        latenciaMs: 0,
      })
      .where(eq(consultas.id, consulta.id));
    return NextResponse.json(
      cuerpoRespuesta({
        texto: previa.texto,
        fuentes: (previa.fuentes ?? []) as FuenteCitada[],
        modelo: previa.modelo,
        cacheada: true,
      })
    );
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

  try {
    const salida = await redactarRespuesta(consulta.pregunta, pasajes);
    const r = salida.redaccion;

    if (!r.texto) {
      return NextResponse.json({ error: "respuesta_vacia" }, { status: 502 });
    }

    // Una redacción con citas a pasajes inexistentes no se guarda en la caché:
    // se muestra con su advertencia a quien la pidió, pero no se reparte.
    const cacheable = r.citasInvalidas.length === 0;
    if (!cacheable) {
      console.warn("[ia] cita a pasaje inexistente:", consulta.id, r.citasInvalidas);
    }

    await db
      .update(consultas)
      .set({
        respuestaLlm: r.texto,
        fuentesLlm: r.fuentes,
        modelo: salida.modelo,
        claveIa: cacheable ? clave : null,
        tokensIn: salida.tokensEntrada,
        tokensOut: salida.tokensSalida,
        latenciaMs: salida.latenciaMs,
      })
      .where(eq(consultas.id, consulta.id));

    return NextResponse.json({
      ...cuerpoRespuesta({ texto: r.texto, fuentes: r.fuentes, modelo: salida.modelo, cacheada: false }),
      latenciaMs: salida.latenciaMs,
    });
  } catch (e) {
    if (e instanceof ErrorProveedor && e.status === 429) {
      // Tope del proveedor, no una caída. La cuota ya descontada se pierde para
      // esta persona: es un caso raro y devolverla exigiría otra escritura
      // concurrente sobre rate_limit.
      const espera = e.reintentarEnSeg ?? 20;
      // Una espera de minutos es el tope DIARIO de tokens del tier gratuito
      // (medido el 13-09-2026: pedía 8 a 27 minutos). Decirle a alguien
      // "reintenta en 1.089 segundos" no sirve; se informa como agotado.
      if (espera > 120) {
        console.warn("[ia] tope diario del proveedor alcanzado; espera pedida:", espera);
        return NextResponse.json(
          {
            error: "proveedor_agotado",
            mensaje:
              "La redacción con IA alcanzó su límite por ahora. Los pasajes de arriba siguen disponibles; vuelve a intentarlo más tarde.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        {
          error: "proveedor_ocupado",
          mensaje: `El redactor está atendiendo otras consultas. Reintenta en ${espera} segundos.`,
          reintentarEnSeg: espera,
        },
        { status: 503, headers: { "Retry-After": String(espera) } }
      );
    }
    console.error("[ia] falló la redacción:", e);
    return NextResponse.json({ error: "proveedor_no_disponible" }, { status: 502 });
  }
}
