// Flujo «Responder una observación del ISP» (encargo D). Ver lib/flujos/observacion.ts.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { productoValido } from "@/lib/calificacion";
import { db } from "@/lib/db";
import { consultas } from "@/lib/db/schema";
import {
  ETIQUETA_BORRADOR,
  MAX_DOCUMENTO,
  SECCIONES,
  SISTEMA_OBSERVACION,
  armarMensajeObservacion,
  huellaDocumento,
  partirSecciones,
  verificarObservacion,
} from "@/lib/flujos/observacion";
import { detectarDatosPacientes } from "@/lib/flujos/pacientes";
import { descontarDelDia, exigirSesion, prepararModelo } from "@/lib/flujos/servidor";
import { MAX_PASAJES, planificarBusquedas, unirPasajes } from "@/lib/ia/planificar";
import { ErrorProveedor, completar } from "@/lib/ia/proveedor";
import { pasajesDesdeResultados, resolverCitas, type FuenteCitada } from "@/lib/ia/redactar";
import { responder } from "@/lib/search";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sesion = await exigirSesion();
  if ("error" in sesion) return sesion.error;
  const { usuario } = sesion;

  let cuerpo: { texto?: unknown; producto?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const texto = typeof cuerpo.texto === "string" ? cuerpo.texto.trim() : "";
  const producto = productoValido(cuerpo.producto);
  if (!texto || !producto) {
    return NextResponse.json({ error: "datos_incompletos", mensaje: "Pega la observación y elige el tipo de producto." }, { status: 400 });
  }
  if (texto.length > MAX_DOCUMENTO) {
    return NextResponse.json(
      { error: "demasiado_largo", mensaje: `La observación puede tener hasta ${MAX_DOCUMENTO.toLocaleString("es-CL")} caracteres.` },
      { status: 400 }
    );
  }

  // Cada ejecución cuenta 1 de las 10 del día, aunque después se bloquee.
  const dia = await descontarDelDia(usuario);
  if ("error" in dia) return dia.error;

  // Antes del modelo: datos de pacientes no salen del servidor.
  const pacientes = detectarDatosPacientes(texto);
  if (pacientes.bloquear) {
    return NextResponse.json(
      { error: "datos_pacientes", motivos: pacientes.motivos, mensaje: pacientes.mensaje, restantesHoy: dia.restantesHoy },
      { status: 422 }
    );
  }

  const modelo = await prepararModelo(usuario);
  if ("error" in modelo) return modelo.error;
  const { config } = modelo;

  const huella = huellaDocumento(texto);
  const consultaId = randomUUID();

  try {
    // Recuperación: la observación resumida como búsqueda y las reescrituras
    // del planificador. El documento entero nunca va al motor como pregunta.
    const plan = await planificarBusquedas(`Observación del ISP sobre un ${producto.toLowerCase()}: ${texto.slice(0, 1500)}`, {
      config,
    });
    const respuestas = [texto.slice(0, 500), ...plan.busquedas.slice(1)].map((b) => responder(b, { k: 6 }));
    const filas = unirPasajes(respuestas, MAX_PASAJES);
    const pasajes = pasajesDesdeResultados(filas);

    const salida = await completar({
      sistema: SISTEMA_OBSERVACION,
      usuario: armarMensajeObservacion(texto, producto, pasajes),
      maxTokens: 2500,
      config,
    });
    const verificacion = verificarObservacion(salida.texto, texto, pasajes);
    const crudas = partirSecciones(salida.texto);
    const fuentes = new Map<number, FuenteCitada>();
    const secciones = {} as Record<(typeof SECCIONES)[number], string>;
    let sinCita: string[] = [];
    for (const s of SECCIONES) {
      const r = resolverCitas(crudas[s], pasajes);
      secciones[s] = r.texto;
      for (const f of r.fuentes) fuentes.set(f.n, f);
      if (s === "Qué exige la norma") sinCita = r.afirmacionesSinCita;
    }
    const textoResuelto = SECCIONES.map((s) => `## ${s}\n${secciones[s]}`).join("\n\n");

    await db
      .insert(consultas)
      .values({
        id: consultaId,
        userId: usuario.id,
        // Solo los primeros 200 caracteres del documento: nunca el texto completo.
        pregunta: `[Observación ISP] ${huella.inicio}`,
        filtros: { modo: "observacion", producto, documentoHash: huella.hash, documentoLargo: huella.largo },
        k: filas.length,
        respuestaLlm: textoResuelto,
        fuentesLlm: [...fuentes.values()],
        modelo: salida.modelo,
        // Nunca entra a la caché compartida.
        claveIa: null,
        tokensIn: salida.tokensEntrada + plan.tokensEntrada,
        tokensOut: salida.tokensSalida + plan.tokensSalida,
        latenciaMs: salida.latenciaMs + plan.latenciaMs,
        proveedor: salida.proveedor,
        costoUsd: salida.costoUsd + plan.costoUsd,
        datosNoVerificados: [...verificacion.cifrasSinRespaldo, ...verificacion.normasSinRespaldo].join(",") || null,
        afirmacionesSinCita: sinCita.length,
        busquedasPlanificadas: plan.planificado ? plan.busquedas.slice(1) : null,
      })
      .catch((e) => console.error("[observacion] no se pudo registrar:", e));

    return NextResponse.json({
      consultaId,
      etiqueta: ETIQUETA_BORRADOR,
      secciones,
      fuentes: [...fuentes.values()].sort((a, b) => a.n - b.n),
      cifrasSinRespaldo: verificacion.cifrasSinRespaldo,
      normasSinRespaldo: verificacion.normasSinRespaldo,
      afirmacionesSinCita: sinCita,
      restantesHoy: dia.restantesHoy,
    });
  } catch (e) {
    if (e instanceof ErrorProveedor && e.status === 429) {
      return NextResponse.json(
        { error: "proveedor_ocupado", mensaje: "El asistente está atendiendo otras consultas. Reintenta en unos minutos." },
        { status: 503 }
      );
    }
    console.error("[observacion] falló:", e);
    return NextResponse.json({ error: "proveedor_no_disponible" }, { status: 502 });
  }
}
