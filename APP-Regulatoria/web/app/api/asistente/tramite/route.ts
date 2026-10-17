// Flujo «¿Qué trámite necesito?» (encargo D). La ruta la decide la tabla
// (lib/flujos/rutas.json); el modelo solo la explica con citas.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { consultas } from "@/lib/db/schema";
import { descontarDelDia, exigirSesion, prepararModelo } from "@/lib/flujos/servidor";
import {
  SISTEMA_TRAMITE,
  armarMensajeTramite,
  describirRespuestas,
  flujoTramiteActivo,
  resolverRuta,
  respuestasValidas,
  rutasSinValidar,
} from "@/lib/flujos/tramite";
import { MAX_PASAJES, unirPasajes } from "@/lib/ia/planificar";
import { ErrorProveedor, completar } from "@/lib/ia/proveedor";
import { pasajesDesdeResultados, resolverCitas } from "@/lib/ia/redactar";
import { responder } from "@/lib/search";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!flujoTramiteActivo()) return NextResponse.json({ error: "flujo_apagado" }, { status: 404 });

  const sesion = await exigirSesion();
  if ("error" in sesion) return sesion.error;
  const { usuario } = sesion;

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const respuestas = respuestasValidas((cuerpo as { respuestas?: unknown })?.respuestas);
  if (!respuestas) return NextResponse.json({ error: "datos_incompletos", mensaje: "Responde las cinco preguntas." }, { status: 400 });

  const dia = await descontarDelDia(usuario);
  if ("error" in dia) return dia.error;

  const ruta = resolverRuta(respuestas);
  if (!ruta) return NextResponse.json({ error: "sin_ruta" }, { status: 500 });

  const base = {
    ruta: { id: ruta.id, tramites: ruta.tramites, autoridad: ruta.autoridad, normas: ruta.normas, nota: ruta.nota ?? null },
    enRevision: rutasSinValidar().length > 0 || !ruta.validado_por_nico,
    restantesHoy: dia.restantesHoy,
  };
  const registrar = (extra: Partial<typeof consultas.$inferInsert>) =>
    db
      .insert(consultas)
      .values({ id: randomUUID(), userId: usuario.id, pregunta: describirRespuestas(respuestas), filtros: { modo: "tramite", ruta: ruta.id }, k: 0, ...extra })
      .catch((e) => console.error("[tramite] no se pudo registrar:", e));

  // Fuera de la base (veterinario, suplementos): la ruta se informa sin modelo.
  if (!ruta.en_la_base || !ruta.normas.length) {
    await registrar({});
    return NextResponse.json({ ...base, explicacion: null, fuentes: [] });
  }

  const modelo = await prepararModelo(usuario);
  if ("error" in modelo) return modelo.error;

  try {
    const filas = unirPasajes(ruta.normas.map((n) => responder(n.busqueda, { k: 3 })), MAX_PASAJES);
    const pasajes = pasajesDesdeResultados(filas);
    if (!pasajes.length) {
      await registrar({});
      return NextResponse.json({ ...base, explicacion: null, fuentes: [] });
    }
    const salida = await completar({
      sistema: SISTEMA_TRAMITE,
      usuario: armarMensajeTramite(respuestas, ruta, pasajes),
      maxTokens: 1500,
      config: modelo.config,
    });
    const r = resolverCitas(salida.texto, pasajes);
    await registrar({
      k: filas.length,
      respuestaLlm: r.texto,
      fuentesLlm: r.fuentes,
      modelo: salida.modelo,
      tokensIn: salida.tokensEntrada,
      tokensOut: salida.tokensSalida,
      latenciaMs: salida.latenciaMs,
      proveedor: salida.proveedor,
      costoUsd: salida.costoUsd,
      afirmacionesSinCita: r.afirmacionesSinCita.length,
    });
    return NextResponse.json({ ...base, explicacion: r.texto, fuentes: r.fuentes, afirmacionesSinCita: r.afirmacionesSinCita });
  } catch (e) {
    if (e instanceof ErrorProveedor && e.status === 429) {
      return NextResponse.json({ ...base, explicacion: null, fuentes: [], aviso: "El asistente está ocupado: te mostramos la ruta sin explicación." });
    }
    console.error("[tramite] falló:", e);
    return NextResponse.json({ ...base, explicacion: null, fuentes: [], aviso: "No pudimos redactar la explicación: te mostramos la ruta." });
  }
}
