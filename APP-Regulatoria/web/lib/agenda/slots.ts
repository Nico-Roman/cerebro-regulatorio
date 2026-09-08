// Generación de huecos: horario de atención menos lo que ya está ocupado,
// menos el buffer, menos lo que cae dentro de la antelación mínima.

import type { ConfigAgenda } from "@/lib/agenda/config";
import type { Ocupado } from "@/lib/agenda/google";
import { horaLocalAUtc, partesEnZona, partirHora } from "@/lib/agenda/tiempo";

export interface Slot {
  inicio: string; // ISO UTC
  fin: string;
}

export interface DiaConSlots {
  fecha: string; // YYYY-MM-DD en la zona de la agenda
  slots: Slot[];
}

/**
 * El buffer se aplica a los dos lados de cada bloque ocupado: si tienes algo
 * hasta las 19:00, el primer hueco no es a las 19:00 sino a las 19:15. Un
 * calendario lleno de reuniones pegadas es exactamente lo que hace que una
 * llamada empiece tarde.
 */
function chocaConOcupado(
  inicio: Date,
  fin: Date,
  ocupados: Ocupado[],
  bufferMs: number
): boolean {
  return ocupados.some(
    (o) =>
      inicio.getTime() < o.fin.getTime() + bufferMs &&
      fin.getTime() > o.inicio.getTime() - bufferMs
  );
}

export function generarSlots(
  config: ConfigAgenda,
  ocupados: Ocupado[],
  ahora = new Date()
): DiaConSlots[] {
  const [hInicio, mInicio] = partirHora(config.horaInicio);
  const [hFin, mFin] = partirHora(config.horaFin);
  const duracionMs = config.duracionMin * 60_000;
  const bufferMs = config.bufferMin * 60_000;
  const noAntesDe = ahora.getTime() + config.antelacionHoras * 3600_000;

  const dias: DiaConSlots[] = [];

  for (let i = 0; i < config.horizonteDias; i++) {
    const referencia = new Date(ahora.getTime() + i * 24 * 3600_000);
    const { anio, mes, dia, diaSemana, iso } = partesEnZona(referencia, config.zona);

    // Rango de días de atención. Soporta ventanas que no cruzan el domingo,
    // que es el caso real (lunes a viernes).
    if (diaSemana < config.diaInicio || diaSemana > config.diaFin) continue;

    const aperturaUtc = horaLocalAUtc(anio, mes, dia, hInicio, mInicio, config.zona);
    const cierreUtc = horaLocalAUtc(anio, mes, dia, hFin, mFin, config.zona);

    const slots: Slot[] = [];
    for (
      let t = aperturaUtc.getTime();
      t + duracionMs <= cierreUtc.getTime();
      t += duracionMs
    ) {
      const inicio = new Date(t);
      const fin = new Date(t + duracionMs);
      if (inicio.getTime() < noAntesDe) continue;
      if (chocaConOcupado(inicio, fin, ocupados, bufferMs)) continue;
      slots.push({ inicio: inicio.toISOString(), fin: fin.toISOString() });
    }

    if (slots.length) dias.push({ fecha: iso, slots });
  }

  return dias;
}
