// Generación de huecos: ventanas de atención menos lo que ya está ocupado,
// menos el buffer, menos lo que cae dentro de la antelación mínima.
//
// Importa con ruta relativa y extensión: lo prueban con `node --test`, que no
// entiende el alias `@/`. Los `import type` desaparecen al quitar los tipos.

import type { ConfigAgenda } from "@/lib/agenda/config";
import type { Ocupado } from "@/lib/agenda/google";
import { horaLocalAUtc, partesEnZona, partirHora } from "./tiempo.ts";

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

/**
 * Los inicios avanzan de a `pasoMin`, no de a `duracionMin`: con reuniones de
 * 30 y paso de 15 se ofrecen 18:00, 18:15, 18:30… Al reservar una, las que se
 * le traslapan desaparecen solas, porque la reserva pasa a ser un bloque
 * ocupado.
 */
export function generarSlots(
  config: Pick<
    ConfigAgenda,
    "duracionMin" | "bufferMin" | "pasoMin" | "ventanas" | "zona" | "antelacionHoras" | "horizonteDias"
  >,
  ocupados: Ocupado[],
  ahora = new Date()
): DiaConSlots[] {
  const duracionMs = config.duracionMin * 60_000;
  const pasoMs = Math.max(5, config.pasoMin || config.duracionMin) * 60_000;
  const bufferMs = config.bufferMin * 60_000;
  const noAntesDe = ahora.getTime() + config.antelacionHoras * 3600_000;

  const dias: DiaConSlots[] = [];

  for (let i = 0; i < config.horizonteDias; i++) {
    const referencia = new Date(ahora.getTime() + i * 24 * 3600_000);
    const { anio, mes, dia, diaSemana, iso } = partesEnZona(referencia, config.zona);

    const slots: Slot[] = [];
    for (const ventana of config.ventanas) {
      if (ventana.dia !== diaSemana) continue;
      const [hInicio, mInicio] = partirHora(ventana.inicio);
      const [hFin, mFin] = partirHora(ventana.fin);
      const aperturaUtc = horaLocalAUtc(anio, mes, dia, hInicio, mInicio, config.zona);
      const cierreUtc = horaLocalAUtc(anio, mes, dia, hFin, mFin, config.zona);

      for (
        let t = aperturaUtc.getTime();
        t + duracionMs <= cierreUtc.getTime();
        t += pasoMs
      ) {
        const inicio = new Date(t);
        const fin = new Date(t + duracionMs);
        if (inicio.getTime() < noAntesDe) continue;
        if (chocaConOcupado(inicio, fin, ocupados, bufferMs)) continue;
        slots.push({ inicio: inicio.toISOString(), fin: fin.toISOString() });
      }
    }

    if (slots.length) {
      slots.sort((a, b) => a.inicio.localeCompare(b.inicio));
      dias.push({ fecha: iso, slots });
    }
  }

  return dias;
}
