// Redacta la respuesta de una consulta ya registrada.
//
// Recibe solo el id de la consulta y vuelve a recuperar los pasajes en el
// servidor. Deliberado: si el navegador pudiera mandar los pasajes, cualquiera
// podría inyectar texto propio en el prompt y hacer que la respuesta "citara"
// una norma inventada.

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { ErrorProveedor } from "@/lib/ia/proveedor";
import { configIaActiva } from "@/lib/ia/config";
import { clasificarPeticion } from "@/lib/ia/proposito";
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
import { consumirCupo, cupoUsado, devolverCupo } from "@/lib/rate-limit";
import { esAdmin, usuarioActual } from "@/lib/sesion";
import { DIA, PREGUNTAS_DIARIAS, claveCupoDiario as claveDia } from "@/lib/ia/cupo";

export const runtime = "nodejs";

// Cuántas respuestas con IA puede pedir cada persona al día: lib/ia/cupo.ts.
// El cupo se consume después de la caché, así que una respuesta repetida no
// cuenta.

// Ráfaga por persona. El tier gratuito de Groq corta a 8.000 tokens por minuto
// (~3 respuestas); esto lo respeta antes de que lo haga el proveedor.
const MAX_RESPUESTAS_MINUTO = Number.parseInt(process.env.LLM_CUOTA_MINUTO ?? "", 10) || 3;

// Techo del SITIO. Sin esto, el cupo por persona no acota el gasto: son 10
// respuestas diarias por cuenta de Google, y las cuentas de Google no escasean.
const MAX_RESPUESTAS_DIA_SITIO = Number.parseInt(process.env.LLM_CUOTA_DIARIA_SITIO ?? "", 10) || 1000;

// Cuántos pasajes entran al prompt. Más de seis no mejora la respuesta y
// multiplica el costo por consulta.
const PASAJES_AL_MODELO = 6;

interface Senales {
  abstuvo: boolean;
  sinCitas: boolean;
  citasInvalidas: boolean;
  datosNoVerificados: string[];
  casoNoCubierto: string[];
}

/** Las señales como columnas de `consultas`. Las listas van separadas por coma. */
function columnasSenales(s: Senales) {
  return {
    abstuvo: s.abstuvo,
    sinCitas: s.sinCitas,
    citasInvalidas: s.citasInvalidas,
    datosNoVerificados: s.datosNoVerificados.length ? s.datosNoVerificados.join(",") : null,
    casoNoCubierto: s.casoNoCubierto.length ? s.casoNoCubierto.join(",") : null,
  };
}

/**
 * Señales de calidad de una redacción ya guardada. Salen de las columnas que
 * escribió la verificación al redactar (0006), no de releer la prosa: buscar
 * "cita no verificable" en el texto confundía el aviso con el contenido.
 *
 * Las filas redactadas antes de 0006 tienen las columnas en nulo; solo para
 * ellas se reconstruye la señal desde el texto, como se hacía antes.
 */
function senalesDeFila(fila: {
  texto: string;
  fuentes: FuenteCitada[];
  abstuvo: boolean | null;
  sinCitas: boolean | null;
  citasInvalidas: boolean | null;
  datosNoVerificados: string | null;
  casoNoCubierto: string | null;
}): Senales {
  const abstuvo = fila.abstuvo ?? esAbstencion(fila.texto);
  return {
    abstuvo,
    sinCitas: fila.sinCitas ?? (!abstuvo && !fila.fuentes.length),
    citasInvalidas: fila.citasInvalidas ?? /cita no verificable/.test(fila.texto),
    datosNoVerificados: fila.datosNoVerificados ? fila.datosNoVerificados.split(",") : [],
    casoNoCubierto: fila.casoNoCubierto ? fila.casoNoCubierto.split(",") : [],
  };
}

function cuerpoRespuesta(p: {
  texto: string;
  fuentes: FuenteCitada[];
  modelo: string | null;
  cacheada: boolean;
  senales: Senales;
}) {
  return {
    respuesta: p.texto,
    fuentes: p.fuentes,
    modelo: p.modelo,
    cacheada: p.cacheada,
    ...p.senales,
  };
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "sesion_requerida" }, { status: 401 });
  if (!usuario.perfilCompleto) {
    return NextResponse.json({ error: "perfil_incompleto" }, { status: 403 });
  }
  // El modelo que esté activo en el panel (o LLM_* si no hay ninguno). Se lee
  // una vez por petición: todo lo de abajo —caché, costo— usa el mismo.
  const config = await configIaActiva();
  if (!config) {
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

  // Esto no es una consulta normativa: no llega al modelo. Determinista y
  // anterior a todo lo demás, así que no gasta tokens ni depende del criterio
  // del modelo. Queda escrito en la fila para poder medir cuánto pasa.
  const veredicto = clasificarPeticion(consulta.pregunta);
  if (veredicto.bloqueada) {
    await db
      .update(consultas)
      .set({ bloqueado: veredicto.motivo })
      .where(eq(consultas.id, consulta.id));
    return NextResponse.json(
      { error: "fuera_de_proposito", motivo: veredicto.motivo, mensaje: veredicto.mensaje },
      { status: 422 }
    );
  }

  // Si ya se redactó antes, se devuelve lo guardado: repetir la llamada solo
  // gastaría tokens para obtener casi lo mismo (temperatura 0).
  if (consulta.respuestaLlm) {
    const fuentes = (consulta.fuentesLlm ?? []) as FuenteCitada[];
    return NextResponse.json(
      cuerpoRespuesta({
        texto: consulta.respuestaLlm,
        fuentes,
        modelo: consulta.modelo,
        cacheada: true,
        senales: senalesDeFila({ ...consulta, texto: consulta.respuestaLlm, fuentes }),
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
  const clave = claveCache(consulta.pregunta, pasajes, config.modelo);
  const [previa] = await db
    .select({
      texto: consultas.respuestaLlm,
      fuentes: consultas.fuentesLlm,
      modelo: consultas.modelo,
      abstuvo: consultas.abstuvo,
      sinCitas: consultas.sinCitas,
      citasInvalidas: consultas.citasInvalidas,
      datosNoVerificados: consultas.datosNoVerificados,
      casoNoCubierto: consultas.casoNoCubierto,
    })
    .from(consultas)
    .where(and(eq(consultas.claveIa, clave), isNotNull(consultas.respuestaLlm)))
    .limit(1);

  if (previa?.texto) {
    const fuentes = (previa.fuentes ?? []) as FuenteCitada[];
    const senales = senalesDeFila({ ...previa, texto: previa.texto, fuentes });
    // Las señales se copian a la fila nueva: sin esto, la consulta semanal
    // contaría los aciertos de caché como borradores sin señal.
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
        proveedor: "cache",
        costoUsd: 0,
        ...columnasSenales(senales),
      })
      .where(eq(consultas.id, consulta.id));
    return NextResponse.json(
      cuerpoRespuesta({ texto: previa.texto, fuentes, modelo: previa.modelo, cacheada: true, senales })
    );
  }

  const rafaga = await consumirCupo(`ia:min:${usuario.id}`, MAX_RESPUESTAS_MINUTO, 60);
  if (!rafaga.permitido) {
    return NextResponse.json(
      { error: "demasiado_rapido", mensaje: "Vas muy rápido para el redactor. Espera unos segundos." },
      { status: 429, headers: { "Retry-After": String(rafaga.reinicioEn) } }
    );
  }

  // Cupo diario: se consume antes de llamar al modelo y se devuelve si la
  // redacción no llega a entregarse.
  const sinLimite = esAdmin(usuario.email);
  if (!sinLimite) {
    const cupo = await consumirCupo(claveDia(usuario.id), PREGUNTAS_DIARIAS, DIA);
    if (!cupo.permitido) {
      return NextResponse.json(
        {
          error: "limite_diario",
          mensaje: `Usaste tus ${PREGUNTAS_DIARIAS} preguntas de hoy. Se renuevan a medianoche, hora de Chile.`,
        },
        { status: 429 }
      );
    }
  }
  const devolver = () => (sinLimite ? Promise.resolve() : devolverCupo(claveDia(usuario.id), DIA));

  const techo = await consumirCupo("ia:sitio", MAX_RESPUESTAS_DIA_SITIO, DIA);
  if (!techo.permitido) {
    console.warn("[ia] techo diario del sitio alcanzado");
    await devolver();
    return NextResponse.json(
      {
        error: "techo_sitio",
        mensaje: "El asistente alcanzó su tope de hoy. Los pasajes de arriba siguen disponibles.",
      },
      { status: 503 }
    );
  }

  try {
    const salida = await redactarRespuesta(consulta.pregunta, pasajes, config);
    const r = salida.redaccion;

    if (!r.texto) {
      await devolver();
      return NextResponse.json({ error: "respuesta_vacia" }, { status: 502 });
    }

    const senales: Senales = {
      abstuvo: r.abstuvo,
      sinCitas: r.sinCitas,
      citasInvalidas: r.citasInvalidas.length > 0,
      datosNoVerificados: r.datosNoVerificados,
      casoNoCubierto: r.casoNoCubierto,
    };

    // Un borrador que no pasa la verificación (cita a un pasaje inexistente,
    // cifra o norma que no está en los pasajes, caso preguntado que los pasajes
    // citados no tratan) no se guarda en la caché: se muestra con su advertencia
    // a quien lo pidió, pero no se reparte. Invariante: lo que está en la caché
    // ya pasó todas las verificaciones, así que un acierto no se revisa de nuevo.
    const cacheable =
      r.citasInvalidas.length === 0 && r.datosNoVerificados.length === 0 && r.casoNoCubierto.length === 0;
    if (!cacheable) {
      console.warn(
        "[ia] borrador no verificado:",
        consulta.id,
        r.citasInvalidas,
        r.datosNoVerificados,
        r.casoNoCubierto
      );
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
        proveedor: salida.proveedor,
        costoUsd: salida.costoUsd,
        ...columnasSenales(senales),
      })
      .where(eq(consultas.id, consulta.id));

    const restantesHoy = sinLimite
      ? null
      : await cupoUsado(claveDia(usuario.id), DIA)
          .then((usadas) => Math.max(0, PREGUNTAS_DIARIAS - usadas))
          .catch(() => null);
    return NextResponse.json({
      ...cuerpoRespuesta({ texto: r.texto, fuentes: r.fuentes, modelo: salida.modelo, cacheada: false, senales }),
      latenciaMs: salida.latenciaMs,
      restantesHoy,
    });
  } catch (e) {
    // Nada llegó a la persona: la pregunta vuelve a su cupo del día.
    await devolver().catch(() => {});
    if (e instanceof ErrorProveedor && e.status === 429) {
      // Tope del proveedor, no una caída. La pregunta ya se devolvió arriba.
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
