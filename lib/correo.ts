// Envío de correo por Resend. Único punto de salida: el formulario de contacto
// y los enlaces de acceso comparten credencial, remitente y manejo de errores.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface CorreoParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export class CorreoNoConfigurado extends Error {
  constructor() {
    super("RESEND_API_KEY no está configurada.");
    this.name = "CorreoNoConfigurado";
  }
}

export async function enviarCorreo({ to, subject, html, replyTo }: CorreoParams) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new CorreoNoConfigurado();

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM || process.env.CONTACTO_FROM ||
        "RegulaMED <onboarding@resend.dev>",
      to: [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Resend respondió ${res.status}: ${detalle}`);
  }
}
