// Escape de HTML para correos. Todo texto que viene de una persona (nombre,
// empresa, pregunta, motivo) pasa por acá antes de entrar a una plantilla.
//
// Sin esto, el resumen semanal y la confirmación de la agenda armaban HTML con
// lo que alguien escribió: un nombre como `<a href="…">` llegaba como enlace
// real en un correo enviado desde regulamed.cl (auditoría 11-09-2026, M5).

export function escaparHtml(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * JSON listo para ir dentro de un `<script type="application/ld+json">`.
 *
 * JSON.stringify no escapa `<`, así que un valor que contenga `</script>`
 * cierra la etiqueta y lo que siga se ejecuta como HTML. Hoy los datos de
 * ld+json son constantes del propio sitio, pero eso es una propiedad del
 * contenido de hoy, no de la función: escapar acá hace que agregar un dato
 * dinámico mañana no abra un XSS.
 */
export function jsonParaScript(valor: unknown): string {
  return JSON.stringify(valor)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/** Solo URL http(s) van dentro de un href; cualquier otra cosa se descarta. */
export function urlSegura(valor: unknown): string | null {
  try {
    const url = new URL(String(valor ?? ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
