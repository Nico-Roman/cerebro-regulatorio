// Actualización de la configuración de la agenda. Vive aparte de la ruta para
// que la validación sea la misma venga de donde venga el cambio.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ConfigAgenda } from "@/lib/agenda/config";

export interface ErroresConfig {
  campo: string;
  mensaje: string;
}

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Valida antes de escribir. Una configuración incoherente (cierre antes de la
 * apertura, duración mayor que la ventana) no rompe nada visible: simplemente
 * deja la agenda sin huecos, y eso se ve como "no hay horas" en vez de como un
 * error. Mejor rechazarlo acá.
 */
export function validar(c: Partial<ConfigAgenda>): ErroresConfig[] {
  const errores: ErroresConfig[] = [];

  if (!c.horaInicio || !HORA.test(c.horaInicio)) {
    errores.push({ campo: "horaInicio", mensaje: "Usa el formato HH:MM (24 horas)." });
  }
  if (!c.horaFin || !HORA.test(c.horaFin)) {
    errores.push({ campo: "horaFin", mensaje: "Usa el formato HH:MM (24 horas)." });
  }
  if (c.horaInicio && c.horaFin && HORA.test(c.horaInicio) && HORA.test(c.horaFin)) {
    const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
    const ventana = minutos(c.horaFin) - minutos(c.horaInicio);
    if (ventana <= 0) {
      errores.push({ campo: "horaFin", mensaje: "El cierre tiene que ser posterior a la apertura." });
    } else if (c.duracionMin && c.duracionMin > ventana) {
      errores.push({
        campo: "duracionMin",
        mensaje: "La reunión no cabe en la ventana de atención.",
      });
    }
  }
  if (c.duracionMin !== undefined && (c.duracionMin < 10 || c.duracionMin > 240)) {
    errores.push({ campo: "duracionMin", mensaje: "Entre 10 y 240 minutos." });
  }
  if (c.bufferMin !== undefined && (c.bufferMin < 0 || c.bufferMin > 120)) {
    errores.push({ campo: "bufferMin", mensaje: "Entre 0 y 120 minutos." });
  }
  if (
    c.diaInicio !== undefined &&
    c.diaFin !== undefined &&
    (c.diaInicio < 1 || c.diaFin > 7 || c.diaInicio > c.diaFin)
  ) {
    errores.push({ campo: "diaInicio", mensaje: "Rango de días inválido (1 = lunes, 7 = domingo)." });
  }
  if (c.horizonteDias !== undefined && (c.horizonteDias < 1 || c.horizonteDias > 120)) {
    errores.push({ campo: "horizonteDias", mensaje: "Entre 1 y 120 días." });
  }
  if (c.antelacionHoras !== undefined && (c.antelacionHoras < 0 || c.antelacionHoras > 720)) {
    errores.push({ campo: "antelacionHoras", mensaje: "Entre 0 y 720 horas." });
  }
  if (c.calendarios && !c.calendarios.length) {
    errores.push({ campo: "calendarios", mensaje: "Deja al menos un calendario." });
  }

  return errores;
}

export async function guardarConfig(c: ConfigAgenda): Promise<void> {
  // UPSERT sobre la única fila: la tabla es configuración, no historial.
  await db.execute(sql`
    INSERT INTO agenda_config (
      id, duracion_min, buffer_min, dia_inicio, dia_fin, hora_inicio, hora_fin,
      zona, antelacion_horas, horizonte_dias, calendarios, activa, updated_at
    ) VALUES (
      'default', ${c.duracionMin}, ${c.bufferMin}, ${c.diaInicio}, ${c.diaFin},
      ${c.horaInicio}, ${c.horaFin}, ${c.zona}, ${c.antelacionHoras},
      ${c.horizonteDias}, ${JSON.stringify(c.calendarios)}::jsonb, ${c.activa}, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      duracion_min = EXCLUDED.duracion_min,
      buffer_min = EXCLUDED.buffer_min,
      dia_inicio = EXCLUDED.dia_inicio,
      dia_fin = EXCLUDED.dia_fin,
      hora_inicio = EXCLUDED.hora_inicio,
      hora_fin = EXCLUDED.hora_fin,
      zona = EXCLUDED.zona,
      antelacion_horas = EXCLUDED.antelacion_horas,
      horizonte_dias = EXCLUDED.horizonte_dias,
      calendarios = EXCLUDED.calendarios,
      activa = EXCLUDED.activa,
      updated_at = now()
  `);
}
