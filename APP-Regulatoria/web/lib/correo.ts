// Envío de correo por Resend. Único punto de salida: el formulario de contacto
// y los enlaces de acceso comparten credencial, remitente y manejo de errores.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface AdjuntoCorreo {
  /** Nombre con el que se ve en el cliente de correo, p. ej. "cita.ics". */
  filename: string;
  /** Contenido ya en base64: es lo que espera la API de Resend. */
  content: string;
  contentType?: string;
}

export interface CorreoParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: AdjuntoCorreo[];
}

export class CorreoNoConfigurado extends Error {
  constructor() {
    super("RESEND_API_KEY no está configurada.");
    this.name = "CorreoNoConfigurado";
  }
}

export async function enviarCorreo({
  to,
  subject,
  html,
  replyTo,
  attachments,
}: CorreoParams) {
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
      ...(attachments?.length ? { attachments } : {}),
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Resend respondió ${res.status}: ${detalle}`);
  }
}
