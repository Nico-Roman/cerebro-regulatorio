// Aritmética de horarios en zona horaria chilena, sin dependencias.
//
// Chile cambia de UTC-4 a UTC-3 dos veces al año. Un slot de las 19:00 no es
// "22:00 UTC" siempre: en invierno son las 23:00 UTC. Guardar el desfase fijo
// es el error clásico, y se paga con reuniones a la hora equivocada dos veces
// por año, así que acá el desfase se calcula para cada instante concreto con
// Intl, que ya conoce la regla vigente.

/** Desfase de la zona respecto de UTC, en minutos, para ese instante. */
export function desfaseZona(fecha: Date, zona: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    fmt.formatToParts(fecha).filter((x) => x.type !== "literal").map((x) => [x.type, x.value])
  ) as Record<string, string>;
  const comoUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) === 24 ? 0 : Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return (comoUtc - fecha.getTime()) / 60000;
}

/**
 * Convierte una hora local de la zona (por ejemplo 2026-09-15 19:00 en Chile)
 * al instante UTC que le corresponde. Dos pasadas: la primera estima con el
 * desfase del instante aproximado, la segunda corrige si esa estimación cayó
 * al otro lado de un cambio de horario.
 */
export function horaLocalAUtc(
  anio: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  zona: string
): Date {
  const estimado = Date.UTC(anio, mes - 1, dia, hora, minuto);
  const desfase1 = desfaseZona(new Date(estimado), zona);
  const candidato = new Date(estimado - desfase1 * 60000);
  const desfase2 = desfaseZona(candidato, zona);
  if (desfase2 === desfase1) return candidato;
  return new Date(estimado - desfase2 * 60000);
}

/** Partes de la fecha (año, mes, día, día de semana ISO) en la zona dada. */
export function partesEnZona(fecha: Date, zona: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const p = Object.fromEntries(
    fmt.formatToParts(fecha).filter((x) => x.type !== "literal").map((x) => [x.type, x.value])
  ) as Record<string, string>;
  const dias: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    diaSemana: dias[p.weekday] ?? 1,
    iso: `${p.year}-${p.month}-${p.day}`,
  };
}

/** "19:30" en la zona pedida, para mostrar y para los correos. */
export function horaEnZona(fecha: Date, zona: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
}

export function fechaLargaEnZona(fecha: Date, zona: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: zona,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fecha);
}

export function partirHora(hhmm: string): [number, number] {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
}
