// Toma de hora. El orden importa: primero se revalida el hueco contra Google y
// contra la base, después se crea el evento, y solo entonces se guarda la
// reserva. Al revés, una falla de Google dejaría una reserva fantasma que
// bloquea un horario que en realidad está libre.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { invalidarCacheHuecos } from "@/lib/agenda/cache";
import { leerConfig } from "@/lib/agenda/config";
import { agendaConfigurada, crearEvento, ocupados } from "@/lib/agenda/google";
import { construirIcs } from "@/lib/agenda/ics";
import { generarSlots } from "@/lib/agenda/slots";
import { fechaLargaEnZona, horaEnZona } from "@/lib/agenda/tiempo";
import { enviarCorreo } from "@/lib/correo";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema";
import { consumirCupo } from "@/lib/rate-limit";
import { SITE } from "@/lib/site";
import { usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  const config = await leerConfig();
  if (!config.activa || !agendaConfigurada()) {
    return NextResponse.json({ error: "agenda_no_disponible" }, { status: 503 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const inicioIso = typeof cuerpo.inicio === "string" ? cuerpo.inicio : "";
  const nombre = typeof cuerpo.nombre === "string" ? cuerpo.nombre.trim().slice(0, 120) : "";
  const email = typeof cuerpo.email === "string" ? cuerpo.email.trim().slice(0, 200) : "";
  const empresa = typeof cuerpo.empresa === "string" ? cuerpo.empresa.trim().slice(0, 160) : "";
  const motivo = typeof cuerpo.motivo === "string" ? cuerpo.motivo.trim().slice(0, 1000) : "";
  // Trampa para bots: un campo que una persona nunca ve ni llena.
  const trampa = typeof cuerpo.web === "string" ? cuerpo.web : "";

  if (trampa) return NextResponse.json({ ok: true });
  if (!inicioIso || !nombre || !EMAIL_VALIDO.test(email)) {
    return NextResponse.json({ error: "datos_incompletos" }, { status: 400 });
  }

  const inicio = new Date(inicioIso);
  if (Number.isNaN(inicio.getTime())) {
    return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
  }
  const fin = new Date(inicio.getTime() + config.duracionMin * 60_000);

  // Tope por IP: 5 reservas por hora. Alguien agendando para su equipo cabe;
  // un script llenando la agenda, no.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
  const cupo = await consumirCupo(`reservar:${ip}`, 5, 3600);
  if (!cupo.permitido) {
    return NextResponse.json({ error: "demasiadas_reservas" }, { status: 429 });
  }

  // Revalidación: el hueco tiene que seguir existiendo ahora, no cuando se
  // pintó la pantalla. Es lo único que evita la doble reserva.
  const hasta = new Date(inicio.getTime() + config.duracionMin * 60_000 + 60_000);
  const [ocupadosGoogle, yaReservado] = await Promise.all([
    ocupados(new Date(Date.now() - 60_000), hasta, config.calendarios),
    db
      .select({ id: reservas.id })
      .from(reservas)
      .where(and(eq(reservas.inicio, inicio), eq(reservas.estado, "confirmada")))
      .limit(1),
  ]);

  if (yaReservado.length) {
    return NextResponse.json({ error: "hueco_tomado" }, { status: 409 });
  }

  const disponibles = generarSlots(config, ocupadosGoogle);
  const sigueLibre = disponibles.some((d) =>
    d.slots.some((s) => s.inicio === inicio.toISOString())
  );
  if (!sigueLibre) {
    return NextResponse.json({ error: "hueco_tomado" }, { status: 409 });
  }

  const usuario = await usuarioActual();
  const tokenGestion = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const id = randomUUID();
  const enlaceGestion = `${SITE.url}/agenda/gestionar?token=${tokenGestion}`;

  let eventoId: string | null = null;
  let meetUrl: string | null = null;

  try {
    const evento = await crearEvento({
      calendarioId: config.calendarios[0],
      titulo: `RegulaMED · ${nombre}${empresa ? ` (${empresa})` : ""}`,
      descripcion: [
        motivo ? `Motivo: ${motivo}` : "Sin motivo declarado.",
        `Correo: ${email}`,
        usuario ? `Usuario registrado: ${usuario.email}` : "No tiene cuenta en el buscador.",
        `Cancelar o reprogramar: ${enlaceGestion}`,
      ].join("\n"),
      inicio,
      fin,
      zona: config.zona,
      invitado: { email, nombre },
    });
    eventoId = evento.id;
    meetUrl = evento.meetUrl;
  } catch (e) {
    console.error("[agenda] falló la creación del evento:", e);
    return NextResponse.json({ error: "calendario_no_disponible" }, { status: 502 });
  }

  await db.insert(reservas).values({
    id,
    userId: usuario?.id ?? null,
    nombre,
    email,
    empresa: empresa || null,
    motivo: motivo || null,
    inicio,
    fin,
    googleEventId: eventoId,
    meetUrl,
    tokenGestion,
  });

  invalidarCacheHuecos();

  const cuando = `${fechaLargaEnZona(inicio, config.zona)}, ${horaEnZona(
    inicio,
    config.zona
  )} h (hora de Chile)`;

  const ics = construirIcs({
    uid: `${id}@regulamed.cl`,
    titulo: `RegulaMED · reunión con ${SITE.nombre}`,
    descripcion: motivo || "Reunión de asesoría regulatoria.",
    inicio,
    fin,
    organizador: process.env.CONTACTO_TO || "contacto@regulamed.cl",
    invitado: email,
    url: meetUrl,
  });

  // El correo no debe poder tumbar una reserva que ya está en el calendario.
  try {
    await enviarCorreo({
      to: email,
      subject: `Reunión confirmada · ${cuando}`,
      html: `
        <p>Hola ${nombre},</p>
        <p>Tu reunión de ${config.duracionMin} minutos quedó agendada para <strong>${cuando}</strong>.</p>
        ${meetUrl ? `<p>Enlace de la videollamada: <a href="${meetUrl}">${meetUrl}</a></p>` : ""}
        <p>Si necesitas cancelar, usa este enlace: <a href="${enlaceGestion}">${enlaceGestion}</a></p>
        <p style="color:#666;font-size:12px">Adjuntamos el archivo .ics por si quieres agregarla a otro calendario.</p>
      `,
      attachments: [
        {
          filename: "reunion-regulamed.ics",
          content: Buffer.from(ics, "utf-8").toString("base64"),
          contentType: "text/calendar",
        },
      ],
    });
  } catch (e) {
    console.error("[agenda] no se pudo enviar la confirmación:", e);
  }

  return NextResponse.json({ ok: true, meetUrl, cuando, enlaceGestion });
}
