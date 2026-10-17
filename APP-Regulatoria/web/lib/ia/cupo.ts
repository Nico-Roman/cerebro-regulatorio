// Cupo diario de preguntas por persona. Sin cobro por uso (decisión del
// 23-09-2026): el límite es control de costo y de abuso, no producto.
//
// Regla del 24-09-2026: cuenta TODO mensaje enviado. Cada pregunta consume 1
// al llegar a /api/search, antes de buscar, aunque después salga de la caché,
// esté fuera de la base, la bloquee la compuerta de propósito o falle el
// proveedor. No hay devoluciones: un cupo que se devuelve según lo que pase
// después es un cupo que nadie puede predecir. El administrador no tiene tope.
//
// Puro a propósito: lib/rate-limit.ts guarda el contador y las pruebas usan
// esto sin base de datos.

export const PREGUNTAS_DIARIAS = Number.parseInt(process.env.PREGUNTAS_DIARIAS ?? "", 10) || 10;

/** Ventana del cupo: un día, alineado a la medianoche de Chile (lib/ventana.ts). */
export const DIA = 86_400;

export const claveCupoDiario = (userId: string) => `ia:dia:${userId}`;

export const MENSAJE_LIMITE_DIARIO = `Usaste tus ${PREGUNTAS_DIARIAS} preguntas de hoy. Se renuevan a medianoche, hora de Chile.`;

export interface DecisionCupo {
  permitido: boolean;
  /** Preguntas que quedan hoy después de esta; null para quien no tiene tope. */
  restantesHoy: number | null;
}

/**
 * Decide con el contador ya incrementado (el de esta pregunta incluida). La
 * pregunta número `maximo` pasa; la siguiente no se procesa.
 */
export function decidirCupo(contador: number, sinLimite: boolean, maximo = PREGUNTAS_DIARIAS): DecisionCupo {
  if (sinLimite) return { permitido: true, restantesHoy: null };
  return { permitido: contador <= maximo, restantesHoy: Math.max(0, maximo - contador) };
}
