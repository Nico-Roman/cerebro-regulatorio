// Dos preguntas que califican la evaluación antes de la reunión (decisión del
// 24-09-2026): qué producto es y en qué etapa está. Las piden la agenda y el
// formulario de contacto, y los flujos del asistente reusan la lista de
// productos. Puro: lo importan componentes de cliente, rutas y pruebas.

export const PRODUCTOS = [
  "Medicamento",
  "Cosmético",
  "Dispositivo médico",
  "Suplemento o alimento",
  "Otro",
] as const;

export const ETAPAS = [
  "Idea",
  "En desarrollo",
  "Listo para presentar",
  "Presentado u observado por el ISP",
  "Registrado",
] as const;

export type Producto = (typeof PRODUCTOS)[number];
export type Etapa = (typeof ETAPAS)[number];

/** El valor si es uno de la lista; "" si no. Nunca se guarda texto libre. */
export function productoValido(v: unknown): Producto | "" {
  return typeof v === "string" && (PRODUCTOS as readonly string[]).includes(v) ? (v as Producto) : "";
}

export function etapaValida(v: unknown): Etapa | "" {
  return typeof v === "string" && (ETAPAS as readonly string[]).includes(v) ? (v as Etapa) : "";
}
