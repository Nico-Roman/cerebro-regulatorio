// «Te respondo yo en 24 horas hábiles» (encargo C2). Cuando el asistente se
// abstiene, la persona puede pedir que un químico farmacéutico le conteste: se
// manda su pregunta y su correo a contacto@regulamed.cl. No guarda nada nuevo:
// la pregunta ya estaba en `consultas` y el correo sale por Resend.

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { consultas } from "@/lib/db/schema";
import { CorreoNoConfigurado, enviarCorreo } from "@/lib/correo";
import { escaparHtml } from "@/lib/html";
import { consumirCupo } from "@/lib/rate-limit";
import { usuarioActual } from "@/lib/sesion";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

// Tres pedidos al día por persona: alcanza para quien de verdad lo necesita y
// evita convertir el botón en una casilla de spam.
const MAX_DIA = 3;

export async function POST(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "sesion_requerida" }, { status: 401 });

  let cuerpo: { consultaId?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const consultaId = typeof cuerpo.consultaId === "string" ? cuerpo.consultaId : "";
  if (!consultaId) return NextResponse.json({ error: "datos_incompletos" }, { status: 400 });

  // Solo la pregunta de la propia persona.
  const [consulta] = await db
    .select({ pregunta: consultas.pregunta })
    .from(consultas)
    .where(and(eq(consultas.id, consultaId), eq(consultas.userId, usuario.id)))
    .limit(1);
  if (!consulta) return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });

  const cupo = await consumirCupo(`humana:${usuario.id}`, MAX_DIA, 86_400);
  if (!cupo.permitido) {
    return NextResponse.json(
      { error: "limite", mensaje: `Puedes pedir hasta ${MAX_DIA} respuestas personales al día. Escríbenos a ${SITE.email}.` },
      { status: 429 }
    );
  }

  try {
    await enviarCorreo({
      to: process.env.CONTACTO_TO || SITE.email,
      replyTo: usuario.email,
      subject: "Pregunta sin respuesta en el asistente — responder en 24 h hábiles",
      html: `
        <p><strong>Quién pregunta:</strong> ${escaparHtml(usuario.email)}</p>
        <p><strong>Pregunta:</strong></p>
        <p style="white-space:pre-wrap">${escaparHtml(consulta.pregunta)}</p>
        <p style="color:#666;font-size:12px">Consulta ${escaparHtml(consultaId)}. El asistente se abstuvo: la base no alcanzó para responder.</p>
      `,
    });
  } catch (e) {
    if (e instanceof CorreoNoConfigurado) {
      return NextResponse.json({ error: "correo_no_configurado", mensaje: `Escríbenos directo a ${SITE.email}.` }, { status: 503 });
    }
    console.error("[respuesta-humana] no se pudo enviar:", e);
    return NextResponse.json({ error: "envio_fallido", mensaje: `No pudimos enviarla. Escríbenos a ${SITE.email}.` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
