// Planes, créditos y la economía que los justifica.
//
// Todo lo que decide cuánto se cobra y cuánto se regala vive en este archivo y
// en nada más. Es puro (sin base de datos ni alias `@/`) a propósito: así las
// pruebas lo importan directo y cualquier cambio de precio pasa por ellas.
//
// Unidad de cobro: el CRÉDITO. Un crédito es un COSTO, no una cantidad de
// tokens: cubre hasta USD_POR_CREDITO de gasto en el modelo. Con gpt-oss-120b
// una consulta típica cuesta la mitad de eso, así que cuesta 1 crédito; con un
// modelo diez veces más caro costaría ~5. Así el margen queda protegido solo,
// sea cual sea el proveedor que esté activo (lib/ia/config.ts), y la persona
// ve un número que entiende ("te quedan 1.850 consultas") en vez de tokens.
//
// Decisiones de Nico (22-09-2026):
//   - Gratis 65 consultas/mes · Profesional $10.000 → 2.000 · Director Técnico
//     $100.000 → 40.000, plan de equipo.
//   - Límite diario en todos los planes.
//   - Packs sin vencimiento, más caros por crédito que el plan Profesional
//     (si no, nadie se suscribe) y con margen ≥ 75 %.
//   - Cálculos con dólar a $1.000.

export type IdPlan = "gratis" | "profesional" | "director_tecnico";

export interface Plan {
  id: IdPlan;
  nombre: string;
  /** Precio mensual con IVA incluido, en pesos. */
  precioMensualClp: number;
  /** Créditos que trae cada ciclo mensual. No se acumulan de un mes a otro. */
  creditosMes: number;
  /** Tope de créditos del plan que se pueden gastar en un día (hora de Chile). */
  limiteDiario: number;
  /** Cuántas personas comparten el cupo. 1 = individual. */
  maxMiembros: number;
  resumen: string;
}

export const PLANES: Record<IdPlan, Plan> = {
  gratis: {
    id: "gratis",
    nombre: "Gratis",
    precioMensualClp: 0,
    creditosMes: 65,
    limiteDiario: 10,
    maxMiembros: 1,
    resumen: "Para probar el buscador con respuestas redactadas.",
  },
  profesional: {
    id: "profesional",
    nombre: "Profesional",
    precioMensualClp: 10_000,
    creditosMes: 2_000,
    limiteDiario: 150,
    maxMiembros: 1,
    resumen: "Para quien consulta normativa todas las semanas.",
  },
  director_tecnico: {
    id: "director_tecnico",
    nombre: "Director Técnico",
    precioMensualClp: 100_000,
    creditosMes: 40_000,
    limiteDiario: 2_000,
    maxMiembros: 10,
    resumen: "Para el equipo regulatorio y de calidad de un laboratorio o droguería.",
  },
};

/** Orden de "mejor plan": si alguien está en dos equipos, manda el más alto. */
export const RANGO_PLAN: Record<IdPlan, number> = { gratis: 0, profesional: 1, director_tecnico: 2 };

export function esIdPlan(v: unknown): v is IdPlan {
  return typeof v === "string" && Object.hasOwn(PLANES, v);
}

export type IdPack = "pack_250" | "pack_1000";

export interface Pack {
  id: IdPack;
  nombre: string;
  creditos: number;
  /** Precio con IVA incluido, en pesos. */
  precioClp: number;
}

export const PACKS: Record<IdPack, Pack> = {
  pack_250: { id: "pack_250", nombre: "Pack 250", creditos: 250, precioClp: 2_000 },
  pack_1000: { id: "pack_1000", nombre: "Pack 1.000", creditos: 1_000, precioClp: 7_000 },
};

export function esIdPack(v: unknown): v is IdPack {
  return typeof v === "string" && Object.hasOwn(PACKS, v);
}

/**
 * Gasto en el modelo que cubre un crédito, en US$. US$1 por cada 1.000
 * créditos = $1 CLP por crédito con el dólar a $1.000. Es el número sobre el que
 * se calcularon todos los márgenes: bajarlo regala, subirlo cobra de más.
 */
export const USD_POR_CREDITO = 0.001;

/**
 * Tope diario de créditos de pack. Los packs sirven para seguir cuando el plan
 * se agotó (en el mes o en el día), pero sin tope un script con saldo podría
 * vaciar la cuenta del proveedor en una tarde.
 */
export const TOPE_DIARIO_PACK = 300;

/** Supuestos de negocio. Los precios del modelo NO van acá: son de cada modelo. */
export const ECONOMIA = {
  dolarClp: 1_000,
  iva: 0.19,
  // Comisión de la pasarela sobre el bruto (Flow / Mercado Pago, aprox.).
  comisionPago: 0.035,
  // Precio de gpt-oss-120b en Groq (US$ por millón). Solo para las consultas
  // anteriores a 0009, que no guardaron su costo: las nuevas guardan el costo
  // real del modelo que las respondió.
  usdMillonEntradaHistorico: 0.15,
  usdMillonSalidaHistorico: 0.6,
} as const;

/**
 * Créditos que cuesta una redacción según lo que costó en el modelo. Mínimo 1:
 * una respuesta nunca es gratis para quien la pide (salvo desde la caché, que
 * ni siquiera llega acá).
 */
export function creditosPorCosto(costoUsd: number): number {
  if (!Number.isFinite(costoUsd) || costoUsd <= 0) return 1;
  // El épsilon evita que 0,002 / 0,001 = 2,0000000000000004 cobre 3.
  return Math.max(1, Math.ceil(costoUsd / USD_POR_CREDITO - 1e-9));
}

/** Costo en US$ de una llamada, con los precios del modelo que la respondió. */
export function costoUsd(
  tokensEntrada: number,
  tokensSalida: number,
  precios: { usdMillonEntrada: number; usdMillonSalida: number }
): number {
  return (
    (Math.max(0, tokensEntrada || 0) * precios.usdMillonEntrada +
      Math.max(0, tokensSalida || 0) * precios.usdMillonSalida) /
    1_000_000
  );
}

/** Lo máximo que puede costar un crédito en el modelo, en pesos. */
export function costoCreditoClp(): number {
  return USD_POR_CREDITO * ECONOMIA.dolarClp;
}

/** Lo que queda en la mano de un precio con IVA, después del IVA y la comisión. */
export function netoClp(precioBrutoClp: number): number {
  return precioBrutoClp / (1 + ECONOMIA.iva) - precioBrutoClp * ECONOMIA.comisionPago;
}

/**
 * Margen sobre el neto si se gastan TODOS los créditos (el peor caso).
 * Devuelve una fracción: 0,76 = 76 %.
 */
export function margenPeorCaso(precioBrutoClp: number, creditos: number, costoCredito = costoCreditoClp()): number {
  const neto = netoClp(precioBrutoClp);
  if (neto <= 0) return 0;
  return (neto - creditos * costoCredito) / neto;
}

// ─── Reglas de consumo ──────────────────────────────────────────────────────

export interface EstadoUso {
  plan: Plan;
  /** Créditos del plan gastados en el ciclo actual (del equipo, si es plan de equipo). */
  usadosCiclo: number;
  /** Créditos del plan gastados hoy (del equipo, si es plan de equipo). */
  usadosHoyPlan: number;
  /** Créditos de pack gastados hoy por esta persona. */
  usadosHoyPack: number;
  /** Saldo de pack de esta persona. No vence. */
  saldoPack: number;
}

export type Fuente = "plan" | "pack";

export type Decision =
  | { permitido: true; fuente: Fuente }
  | { permitido: false; motivo: "limite_diario" | "sin_creditos"; mensaje: string };

/**
 * De dónde sale el crédito de la próxima redacción. Primero el plan (vence a
 * fin de ciclo, así que conviene gastarlo antes); si el plan ya no alcanza, hoy
 * o en el mes, el pack.
 */
export function decidirFuente(e: EstadoUso): Decision {
  const quedaMes = e.usadosCiclo < e.plan.creditosMes;
  const quedaHoy = e.usadosHoyPlan < e.plan.limiteDiario;
  if (quedaMes && quedaHoy) return { permitido: true, fuente: "plan" };

  if (e.saldoPack >= 1 && e.usadosHoyPack < TOPE_DIARIO_PACK) {
    return { permitido: true, fuente: "pack" };
  }

  if (e.saldoPack >= 1) {
    return {
      permitido: false,
      motivo: "limite_diario",
      mensaje: `Llegaste al tope diario de ${TOPE_DIARIO_PACK} créditos de pack. Mañana puedes seguir; los pasajes siguen disponibles.`,
    };
  }
  if (!quedaMes) {
    return {
      permitido: false,
      motivo: "sin_creditos",
      mensaje: `Usaste las ${formatoMiles(e.plan.creditosMes)} respuestas con IA de tu plan ${e.plan.nombre} de este mes. Los pasajes siguen disponibles.`,
    };
  }
  return {
    permitido: false,
    motivo: "limite_diario",
    mensaje: `Llegaste a las ${formatoMiles(e.plan.limiteDiario)} respuestas redactadas de hoy de tu plan ${e.plan.nombre}. Mañana se renueva; los pasajes siguen disponibles.`,
  };
}

export interface Restantes {
  mes: number;
  hoy: number;
  pack: number;
}

/** Lo que le queda a la persona, para mostrarlo. Nunca negativo. */
export function restantes(e: EstadoUso): Restantes {
  const mes = Math.max(0, e.plan.creditosMes - e.usadosCiclo);
  return {
    mes,
    hoy: Math.min(mes, Math.max(0, e.plan.limiteDiario - e.usadosHoyPlan)),
    pack: Math.max(0, e.saldoPack),
  };
}

export function formatoMiles(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatoClp(n: number): string {
  return n < 0 ? `-$${formatoMiles(-n)}` : `$${formatoMiles(n)}`;
}
