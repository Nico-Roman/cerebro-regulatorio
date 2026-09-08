// Archivo .ics para adjuntar en el correo de confirmación. Es lo que hace que
// la cita entre al calendario del invitado aunque no use Google.

function aFechaIcs(fecha: Date): string {
  return fecha.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Las líneas de un .ics van con CRLF y plegadas a 75 octetos; los lectores
 *  estrictos rechazan el archivo si no. */
function plegar(linea: string): string {
  const partes: string[] = [];
  let resto = linea;
  while (resto.length > 74) {
    partes.push(resto.slice(0, 74));
    resto = " " + resto.slice(74);
  }
  partes.push(resto);
  return partes.join("\r\n");
}

export function construirIcs(params: {
  uid: string;
  titulo: string;
  descripcion: string;
  inicio: Date;
  fin: Date;
  organizador: string;
  invitado: string;
  url?: string | null;
  cancelado?: boolean;
}): string {
  const escapar = (t: string) =>
    t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RegulaMED//Agenda//ES",
    `METHOD:${params.cancelado ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${aFechaIcs(new Date())}`,
    `DTSTART:${aFechaIcs(params.inicio)}`,
    `DTEND:${aFechaIcs(params.fin)}`,
    `SUMMARY:${escapar(params.titulo)}`,
    `DESCRIPTION:${escapar(params.descripcion)}`,
    params.url ? `URL:${params.url}` : "",
    `ORGANIZER:mailto:${params.organizador}`,
    `ATTENDEE;RSVP=TRUE:mailto:${params.invitado}`,
    `STATUS:${params.cancelado ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lineas.map(plegar).join("\r\n");
}
