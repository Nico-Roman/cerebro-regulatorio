// Huecos reales: horario de atención menos el calendario de Nico menos las
// reservas ya tomadas. Público a propósito — es la puerta de entrada de un
// cliente que todavía no tiene cuenta.

import { NextResponse } from "next/server";
import { and, gte, eq } from "drizzle-orm";
import {
  guardarCacheHuecos,
  leerCacheHuecos,
} from "@/lib/agenda/cache";
import { leerConfig } from "@/lib/agenda/config";
import { agendaConfigurada, ocupados } from "@/lib/agenda/google";
import { generarSlots } from "@/lib/agenda/slots";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const config = await leerConfig();

  if (!config.activa || !agendaConfigurada()) {
    return NextResponse.json(
      {
        disponible: false,
        motivo: !config.activa ? "agenda_desactivada" : "agenda_sin_configurar",
        dias: [],
      },
      { status: 200 }
    );
  }

  // La disponibilidad cambia poco en un minuto y así una visita con muchos
  // clics no gasta cuota de la API de Google.
  const enCache = leerCacheHuecos();
  if (enCache) return NextResponse.json(enCache);

  const desde = new Date();
  const hasta = new Date(desde.getTime() + config.horizonteDias * 24 * 3600_000);

  try {
    const [ocupadosGoogle, reservadas] = await Promise.all([
      ocupados(desde, hasta, config.calendarios),
      db
        .select({ inicio: reservas.inicio, fin: reservas.fin })
        .from(reservas)
        .where(and(gte(reservas.inicio, desde), eq(reservas.estado, "confirmada"))),
    ]);

    // Las reservas propias se suman a lo ocupado: el evento de Google ya las
    // cubre, pero si la creación del evento falló y la reserva quedó igual,
    // esto evita entregar dos veces el mismo horario.
    const todos = [
      ...ocupadosGoogle,
      ...reservadas.map((r) => ({ inicio: new Date(r.inicio), fin: new Date(r.fin) })),
    ];

    const datos = {
      disponible: true,
      zona: config.zona,
      duracionMin: config.duracionMin,
      dias: generarSlots(config, todos),
    };
    guardarCacheHuecos(datos);
    return NextResponse.json(datos);
  } catch (e) {
    console.error("[agenda] no se pudo consultar la disponibilidad:", e);
    return NextResponse.json(
      { disponible: false, motivo: "error_calendario", dias: [] },
      { status: 200 }
    );
  }
}
