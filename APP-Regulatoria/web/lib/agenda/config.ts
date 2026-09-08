// Configuración de la agenda: la fila 'default' de la base, con valores por
// defecto si la tabla todavía está vacía (primer arranque tras la migración).

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agendaConfig } from "@/lib/db/schema";

export interface ConfigAgenda {
  duracionMin: number;
  bufferMin: number;
  diaInicio: number;
  diaFin: number;
  horaInicio: string;
  horaFin: string;
  zona: string;
  antelacionHoras: number;
  horizonteDias: number;
  calendarios: string[];
  activa: boolean;
}

export const CONFIG_POR_DEFECTO: ConfigAgenda = {
  duracionMin: 30,
  bufferMin: 15,
  diaInicio: 1,
  diaFin: 5,
  horaInicio: "19:00",
  horaFin: "22:00",
  zona: "America/Santiago",
  antelacionHoras: 24,
  horizonteDias: 21,
  calendarios: ["primary"],
  activa: true,
};

export async function leerConfig(): Promise<ConfigAgenda> {
  try {
    const [fila] = await db
      .select()
      .from(agendaConfig)
      .where(eq(agendaConfig.id, "default"))
      .limit(1);
    if (!fila) return CONFIG_POR_DEFECTO;
    const calendarios = Array.isArray(fila.calendarios)
      ? (fila.calendarios as string[])
      : CONFIG_POR_DEFECTO.calendarios;
    return {
      duracionMin: fila.duracionMin,
      bufferMin: fila.bufferMin,
      diaInicio: fila.diaInicio,
      diaFin: fila.diaFin,
      horaInicio: fila.horaInicio,
      horaFin: fila.horaFin,
      zona: fila.zona,
      antelacionHoras: fila.antelacionHoras,
      horizonteDias: fila.horizonteDias,
      calendarios: calendarios.length ? calendarios : CONFIG_POR_DEFECTO.calendarios,
      activa: fila.activa,
    };
  } catch {
    // Si la tabla todavía no existe (despliegue a mitad de migración), la
    // agenda usa los valores por defecto en vez de tirar un 500.
    return CONFIG_POR_DEFECTO;
  }
}
