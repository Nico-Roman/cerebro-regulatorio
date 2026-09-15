// Formulario de contacto público.
//
// El envío sale por lib/correo (Resend): es el único punto de salida de correo
// del proyecto, y tenerlo repetido acá significaba que el timeout, el remitente
// y el saneado del asunto se arreglaban en un lado y no en el otro.

import { NextRequest, NextResponse } from "next/server";
import { CorreoNoConfigurado, enviarCorreo } from "@/lib/correo";
import { escaparHtml as escapar } from "@/lib/html";
import { ipCliente } from "@/lib/ip";
import { consumirCupo } from "@/lib/rate-limit";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

// Sin sesión ni captcha, el honeypot era lo único entre el formulario y la
// casilla de contacto: un script podía dejarla inservible y gastar la cuota de
// Resend. Cinco mensajes por hora cubre a quien escribe dos veces porque se le
// olvidó un dato, y corta el envío masivo.
const MAX_MENSAJES_HORA = 5;

interface Payload {
  nombre?: string;
  empresa?: string;
  email?: string;
  area?: string;
  mensaje?: string;
  website?: string;
}

function limpiar(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mensaje: "Solicitud inválida." }, { status: 400 });
  }

  // Honeypot: si viene relleno es un bot. Respondemos ok para no darle señal.
  if (limpiar(body.website, 100)) {
    return NextResponse.json({ ok: true });
  }

  const nombre = limpiar(body.nombre, 120);
  const empresa = limpiar(body.empresa, 120);
  const email = limpiar(body.email, 160);
  const area = limpiar(body.area, 120);
  const mensaje = limpiar(body.mensaje, 4000);

  if (!nombre || !email || !mensaje) {
    return NextResponse.json(
      { ok: false, mensaje: "Faltan campos obligatorios." },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, mensaje: "El correo no es válido." }, { status: 400 });
  }

  // La IP es la que agrega Railway, no la que declara el cliente (ver lib/ip).
  const cupo = await consumirCupo(
    `contacto:${ipCliente(req.headers)}`,
    MAX_MENSAJES_HORA,
    3600
  );
  if (!cupo.permitido) {
    return NextResponse.json(
      { ok: false, mensaje: "Recibimos varios mensajes tuyos. Intenta más tarde." },
      { status: 429, headers: { "Retry-After": String(cupo.reinicioEn) } }
    );
  }

  const html = `
    <h2>Nueva consulta desde ${SITE.nombre}</h2>
    <p><strong>Nombre:</strong> ${escapar(nombre)}</p>
    <p><strong>Empresa:</strong> ${escapar(empresa) || "—"}</p>
    <p><strong>Correo:</strong> ${escapar(email)}</p>
    <p><strong>Tema:</strong> ${escapar(area) || "—"}</p>
    <hr />
    <p style="white-space:pre-wrap">${escapar(mensaje)}</p>
  `;

  try {
    await enviarCorreo({
      to: process.env.CONTACTO_TO || SITE.email,
      from: process.env.CONTACTO_FROM,
      replyTo: email,
      subject: `Consulta regulatoria — ${nombre}${empresa ? ` (${empresa})` : ""}`,
      html,
    });
  } catch (e) {
    if (e instanceof CorreoNoConfigurado) {
      // Sin credencial no hay entrega posible: se dice, en vez de fingir un
      // envío exitoso y perder la consulta en silencio.
      console.error("[contacto] RESEND_API_KEY no configurada. Consulta recibida de:", email);
      return NextResponse.json(
        { ok: false, mensaje: "El envío por formulario aún no está habilitado." },
        { status: 503 }
      );
    }
    console.error("[contacto] no se pudo entregar el mensaje:", e);
    return NextResponse.json(
      { ok: false, mensaje: "No pudimos entregar el mensaje." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
