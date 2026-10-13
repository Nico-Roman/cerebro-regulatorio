// Actualización de la configuración de la agenda. Vive aparte de la ruta para
// que la validación sea la misma venga de donde venga el cambio.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ConfigAgenda } from "@/lib/agenda/config";
import { problemasVentanas } from "@/lib/agenda/ventanas";

export interface ErroresConfig {
  campo: string;
  mensaje: string;
}

/**
 * Valida antes de escribir. Una configuración incoherente (cierre antes de la
 * apertura, duración mayor que la ventana) no rompe nada visible: simplemente
 * deja la agenda sin huecos, y eso se ve como "no hay horas" en vez de como un
 * error. Mejor rechazarlo acá.
 */
export function validar(c: Partial<ConfigAgenda>): ErroresConfig[] {
  const errores: ErroresConfig[] = [];

  if (c.ventanas) {
    for (const mensaje of problemasVentanas(c.ventanas, c.duracionMin ?? 0)) {
      errores.push({ campo: "ventanas", mensaje });
    }
  }
  if (c.duracionMin !== undefined && (c.duracionMin < 10 || c.duracionMin > 240)) {
    errores.push({ campo: "duracionMin", mensaje: "Entre 10 y 240 minutos." });
  }
  if (c.pasoMin !== undefined && (c.pasoMin < 5 || c.pasoMin > 240)) {
    errores.push({ campo: "pasoMin", mensaje: "El paso entre inicios va de 5 a 240 minutos." });
  }
  if (c.bufferMin !== undefined && (c.bufferMin < 0 || c.bufferMin > 120)) {
    errores.push({ campo: "bufferMin", mensaje: "Entre 0 y 120 minutos." });
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
  // UPSERT sobre la única fila: la tabla es configuración, no historial. Las
  // columnas del rango viejo (dia_inicio … hora_fin) no se tocan: con
  // `ventanas` llena nadie las lee.
  await db.execute(sql`
    INSERT INTO agenda_config (
      id, duracion_min, buffer_min, paso_min, ventanas,
      zona, antelacion_horas, horizonte_dias, calendarios, activa, updated_at
    ) VALUES (
      'default', ${c.duracionMin}, ${c.bufferMin}, ${c.pasoMin},
      ${JSON.stringify(c.ventanas)}::jsonb, ${c.zona}, ${c.antelacionHoras},
      ${c.horizonteDias}, ${JSON.stringify(c.calendarios)}::jsonb, ${c.activa}, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      duracion_min = EXCLUDED.duracion_min,
      buffer_min = EXCLUDED.buffer_min,
      paso_min = EXCLUDED.paso_min,
      ventanas = EXCLUDED.ventanas,
      zona = EXCLUDED.zona,
      antelacion_horas = EXCLUDED.antelacion_horas,
      horizonte_dias = EXCLUDED.horizonte_dias,
      calendarios = EXCLUDED.calendarios,
      activa = EXCLUDED.activa,
      updated_at = now()
  `);
}
