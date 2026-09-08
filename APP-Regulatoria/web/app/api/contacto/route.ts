import { NextResponse } from "next/server";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

// El envío real se hace con Resend porque no requiere servidor SMTP propio.
// Sin RESEND_API_KEY configurada el formulario no puede entregar el mensaje;
// en ese caso lo decimos explícitamente en vez de fingir un envío exitoso.
const RESEND_ENDPOINT = "https://api.resend.com/emails";

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

function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[contacto] RESEND_API_KEY no configurada. Consulta recibida de:", email);
    return NextResponse.json(
      {
        ok: false,
        mensaje: "El envío por formulario aún no está habilitado.",
      },
      { status: 503 }
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

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.CONTACTO_FROM || "RegulaMED <onboarding@resend.dev>",
      to: [process.env.CONTACTO_TO || SITE.email],
      reply_to: email,
      subject: `Consulta regulatoria — ${nombre}${empresa ? ` (${empresa})` : ""}`,
      html,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text();
    console.error("[contacto] Resend respondió", res.status, detalle);
    return NextResponse.json(
      { ok: false, mensaje: "No pudimos entregar el mensaje." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
