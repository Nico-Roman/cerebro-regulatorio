// «¿Qué trámite necesito?» (encargo D, flujo 2). La ruta sale de una tabla
// determinista (rutas.json), nunca del modelo: el modelo solo la explica con
// los pasajes que el motor recupera para las normas de esa ruta.

import datos from "./rutas.json" with { type: "json" };

export type Respuestas = {
  producto: string;
  origen: string;
  uso: string;
  situacion: string;
  registro_extranjero: string;
};

export interface NormaRuta {
  norma: string;
  cita: string;
  busqueda: string;
}

export interface Ruta {
  id: string;
  cuando: Partial<Record<keyof Respuestas, string[]>>;
  tramites: string[];
  autoridad: string;
  en_la_base: boolean;
  normas: NormaRuta[];
  nota?: string;
  validado_por_nico: boolean;
}

export interface Pregunta {
  clave: keyof Respuestas;
  texto: string;
  opciones: Record<string, string>;
}

export const PREGUNTAS = datos.preguntas as unknown as Pregunta[];
export const RUTAS = datos.rutas as unknown as Ruta[];

/** Las cinco respuestas, solo si cada una es una opción válida. */
export function respuestasValidas(v: unknown): Respuestas | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const salida: Partial<Respuestas> = {};
  for (const p of PREGUNTAS) {
    const r = o[p.clave];
    if (typeof r !== "string" || !(r in p.opciones)) return null;
    salida[p.clave] = r;
  }
  return salida as Respuestas;
}

/** Primera regla cuyas condiciones se cumplen. La tabla cubre todas las combinaciones (lo prueba tests/flujos.test.mts). */
export function resolverRuta(r: Respuestas): Ruta | null {
  return (
    RUTAS.find((ruta) =>
      Object.entries(ruta.cuando).every(([clave, valores]) => (valores as string[]).includes(r[clave as keyof Respuestas]))
    ) ?? null
  );
}

/** Rutas que Nico todavía no valida: mientras haya alguna, el flujo lo advierte. */
export function rutasSinValidar(): string[] {
  return RUTAS.filter((r) => !r.validado_por_nico).map((r) => r.id);
}

/** El flujo está apagado salvo FLUJO_TRAMITE=on (hasta que Nico valide rutas.json). */
export function flujoTramiteActivo(): boolean {
  return process.env.FLUJO_TRAMITE === "on";
}

export function describirRespuestas(r: Respuestas): string {
  return PREGUNTAS.map((p) => `${p.texto} ${p.opciones[r[p.clave]]}`).join(" · ");
}

export const SISTEMA_TRAMITE = [
  "Explicas a un químico farmacéutico chileno qué trámite corresponde a su producto.",
  "La ruta ya está decidida y viene en <ruta>: no la cambies, no agregues trámites ni autoridades.",
  "Explica cada trámite en una o dos oraciones usando SOLO los PASAJES DISPONIBLES, con la cita [Pn]",
  "al final de cada afirmación. Si un trámite no tiene pasaje que lo respalde, dilo («los pasajes no",
  "detallan este trámite») en vez de completarlo. No inventes plazos, costos ni requisitos.",
  "Español de Chile, tono profesional, máximo 220 palabras, texto corrido.",
].join("\n");

export function armarMensajeTramite(r: Respuestas, ruta: Ruta, pasajes: { cita: string; texto: string }[]): string {
  return [
    "PASAJES DISPONIBLES:",
    ...pasajes.map((p, i) => `--- [P${i + 1}] ${p.cita} ---\n${p.texto.replace(/\s+/g, " ").trim()}`),
    "",
    `<situacion>${describirRespuestas(r)}</situacion>`,
    `<ruta>Autoridad: ${ruta.autoridad}\n${ruta.tramites.map((t) => `- ${t}`).join("\n")}</ruta>`,
  ].join("\n");
}
