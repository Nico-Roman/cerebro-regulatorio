// Google Calendar por HTTP directo, sin el paquete googleapis.
//
// Solo se usan tres llamadas (token, freeBusy, events) y el paquete oficial
// pesa decenas de megas en la imagen de producción. Menos dependencias es
// también menos superficie que actualizar por seguridad.
//
// El refresh token es de la cuenta de Nico: nadie más autoriza nada. La app
// OAuth debe estar publicada en "producción" — en modo prueba el refresh token
// caduca a los 7 días y la agenda se rompería sola cada semana.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";

export interface Ocupado {
  inicio: Date;
  fin: Date;
}

export function agendaConfigurada(): boolean {
  return Boolean(
    process.env.GOOGLE_CAL_CLIENT_ID &&
      process.env.GOOGLE_CAL_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
  );
}

// Un access token dura una hora; se guarda en memoria del proceso para no pedir
// uno nuevo en cada búsqueda de huecos.
let cache: { token: string; expira: number } | null = null;

async function accessToken(): Promise<string> {
  if (cache && cache.expira > Date.now() + 60_000) return cache.token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CAL_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CAL_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Google no renovó el token (${res.status}): ${await res.text()}`);
  }
  const datos = (await res.json()) as { access_token: string; expires_in: number };
  cache = { token: datos.access_token, expira: Date.now() + datos.expires_in * 1000 };
  return datos.access_token;
}

/** Bloques ocupados en todos los calendarios consultados. */
export async function ocupados(
  desde: Date,
  hasta: Date,
  calendarios: string[]
): Promise<Ocupado[]> {
  const res = await fetch(`${CAL_API}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: desde.toISOString(),
      timeMax: hasta.toISOString(),
      items: calendarios.map((id) => ({ id })),
    }),
  });

  if (!res.ok) {
    throw new Error(`freeBusy respondió ${res.status}: ${await res.text()}`);
  }

  const datos = (await res.json()) as {
    calendars: Record<string, { busy?: { start: string; end: string }[] }>;
  };

  return Object.values(datos.calendars || {}).flatMap((c) =>
    (c.busy || []).map((b) => ({ inicio: new Date(b.start), fin: new Date(b.end) }))
  );
}

export interface EventoCreado {
  id: string;
  meetUrl: string | null;
}

export async function crearEvento(params: {
  calendarioId: string;
  titulo: string;
  descripcion: string;
  inicio: Date;
  fin: Date;
  zona: string;
  invitado: { email: string; nombre: string };
}): Promise<EventoCreado> {
  const res = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(params.calendarioId)}/events` +
      "?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: params.titulo,
        description: params.descripcion,
        start: { dateTime: params.inicio.toISOString(), timeZone: params.zona },
        end: { dateTime: params.fin.toISOString(), timeZone: params.zona },
        attendees: [
          { email: params.invitado.email, displayName: params.invitado.nombre },
        ],
        conferenceData: {
          createRequest: {
            requestId: `regulamed-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 30 },
          ],
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`No se pudo crear el evento (${res.status}): ${await res.text()}`);
  }

  const evento = (await res.json()) as {
    id: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] };
  };

  const meet =
    evento.hangoutLink ||
    evento.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    null;

  return { id: evento.id, meetUrl: meet };
}

export async function cancelarEvento(calendarioId: string, eventoId: string): Promise<void> {
  const res = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(calendarioId)}/events/${encodeURIComponent(
      eventoId
    )}?sendUpdates=all`,
    { method: "DELETE", headers: { Authorization: `Bearer ${await accessToken()}` } }
  );
  // 410 = ya estaba borrado en Google. No es un error para nosotros: el estado
  // final es el que queríamos.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`No se pudo cancelar el evento (${res.status}): ${await res.text()}`);
  }
}
