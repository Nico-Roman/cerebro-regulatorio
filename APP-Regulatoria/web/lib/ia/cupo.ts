// Cupo diario de preguntas con IA por persona. Sin cobro por uso (decisión del
// 23-09-2026): el límite es control de costo y de abuso, no producto. Solo
// cuentan las respuestas entregadas; las de caché, las fuera de la base y las
// que fallan no gastan cupo. El administrador no tiene tope.

export const PREGUNTAS_DIARIAS = Number.parseInt(process.env.PREGUNTAS_DIARIAS ?? "", 10) || 10;

/** Ventana del cupo: un día, alineado a la medianoche de Chile (lib/rate-limit.ts). */
export const DIA = 86_400;

export const claveCupoDiario = (userId: string) => `ia:dia:${userId}`;
