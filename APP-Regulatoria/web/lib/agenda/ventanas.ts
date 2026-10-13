// Ventanas de atención por día de la semana. Sin base ni Next: lo importan las
// pruebas con `node --test` además de la configuración y el panel.

export interface Ventana {
  dia: number; // 1 = lunes … 7 = domingo (ISO)
  inicio: string; // HH:MM, hora de la zona de la agenda
  fin: string; // HH:MM: la última reunión tiene que terminar a esta hora
}

export const NOMBRES_DIA = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function minutosDelDia(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
}

function esVentana(v: unknown): v is Ventana {
  const x = v as Ventana;
  return (
    !!x &&
    Number.isInteger(x.dia) &&
    typeof x.inicio === "string" &&
    typeof x.fin === "string"
  );
}

/**
 * Lo que trae la fila de `agenda_config`. Si `ventanas` está vacía (una base
 * de antes de la migración 0011), se arma desde el rango viejo para que la
 * agenda siga publicando lo mismo que publicaba.
 */
export function ventanasDesdeFila(fila: {
  ventanas: unknown;
  diaInicio: number;
  diaFin: number;
  horaInicio: string;
  horaFin: string;
}): Ventana[] {
  if (Array.isArray(fila.ventanas)) {
    const validas = fila.ventanas.filter(esVentana);
    if (validas.length) return [...validas].sort((a, b) => a.dia - b.dia);
  }
  const ventanas: Ventana[] = [];
  for (let dia = fila.diaInicio; dia <= fila.diaFin; dia++) {
    ventanas.push({ dia, inicio: fila.horaInicio, fin: fila.horaFin });
  }
  return ventanas;
}

/**
 * Errores de un juego de ventanas, en palabras para el panel. Una ventana
 * incoherente no rompe nada visible: deja ese día sin huecos, y eso se ve como
 * "no hay horas" en vez de como un error. Mejor rechazarla al guardar.
 */
export function problemasVentanas(ventanas: Ventana[], duracionMin: number): string[] {
  const problemas: string[] = [];
  if (!ventanas.length) problemas.push("Deja al menos un día con horario de atención.");

  const vistos = new Set<number>();
  for (const v of ventanas) {
    const nombre = NOMBRES_DIA[v.dia] ?? `día ${v.dia}`;
    if (v.dia < 1 || v.dia > 7) {
      problemas.push(`Día inválido (${v.dia}): usa 1 = lunes … 7 = domingo.`);
      continue;
    }
    // Una por día: el panel edita una sola, y una segunda guardada por otra vía
    // se perdería sin aviso al volver a guardar desde ahí.
    if (vistos.has(v.dia)) problemas.push(`${nombre} tiene más de una ventana.`);
    vistos.add(v.dia);
    if (!HORA.test(v.inicio) || !HORA.test(v.fin)) {
      problemas.push(`${nombre}: usa el formato HH:MM (24 horas).`);
      continue;
    }
    const largo = minutosDelDia(v.fin) - minutosDelDia(v.inicio);
    if (largo <= 0) {
      problemas.push(`${nombre}: el cierre tiene que ser posterior a la apertura.`);
    } else if (duracionMin > largo) {
      problemas.push(`${nombre}: la reunión no cabe en la ventana.`);
    }
  }
  return problemas;
}
