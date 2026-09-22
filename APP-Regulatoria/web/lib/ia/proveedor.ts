// Llamada al modelo por HTTP, contra cualquier proveedor con API compatible con
// OpenAI (Groq, OpenAI, DeepSeek, Together, y Gemini por su endpoint de
// compatibilidad).
//
// Sin SDK a propósito: es un POST con un JSON. Cambiar de proveedor es elegir
// otro modelo en el panel (/admin/planes → lib/ia/config.ts), o, sin base de
// datos (scripts de evaluación), cambiar LLM_BASE_URL / LLM_MODEL. Ni código
// ni dependencias.
//
// Este archivo no toca la base a propósito: los scripts de evaluación lo
// importan directo con Node. La configuración del panel llega como parámetro.

/** A quién se le habla y cuánto cobra. */
export interface ConfigIa {
  /** Id del modelo en el catálogo (modelos_ia), o null si viene del entorno. */
  modeloId: string | null;
  proveedor: string;
  baseUrl: string;
  modelo: string;
  apiKey: string;
  usdMillonEntrada: number;
  usdMillonSalida: number;
  origen: "panel" | "entorno";
}

export interface RespuestaModelo {
  texto: string;
  modelo: string;
  proveedor: string;
  /** Lo que costó esta llamada con los precios del modelo que respondió. */
  costoUsd: number;
  tokensEntrada: number;
  tokensSalida: number;
  /** Parte de tokensSalida gastada en razonar; 0 si el proveedor no la informa. */
  tokensRazonamiento: number;
  latenciaMs: number;
}

/**
 * Error del proveedor con su código HTTP. El 429 del tier gratuito de Groq
 * (8.000 tokens por minuto, unas tres respuestas) no es una caída: se informa
 * como "ocupado, reintenta en N segundos" y no como "no disponible".
 */
export class ErrorProveedor extends Error {
  status: number;
  reintentarEnSeg: number | null;
  constructor(status: number, detalle: string, reintentarEnSeg: number | null) {
    super(`El proveedor respondió ${status}: ${detalle}`);
    this.status = status;
    this.reintentarEnSeg = reintentarEnSeg;
  }
}

/** ¿Hay IA configurada por variables de entorno? (La del panel: lib/ia/config.ts.) */
export function iaConfigurada(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

export function modeloActual(): string {
  // gpt-oss-120b en Groq: del orden de un dólar por cada mil respuestas y
  // buen español.
  return process.env.LLM_MODEL || "openai/gpt-oss-120b";
}

export const BASE_URL_POR_DEFECTO = "https://api.groq.com/openai/v1";

function numeroEnv(nombre: string, porDefecto: number): number {
  const n = Number.parseFloat(process.env[nombre] ?? "");
  return Number.isFinite(n) && n >= 0 ? n : porDefecto;
}

/**
 * La configuración de siempre: variables LLM_*. Es el respaldo cuando en el
 * panel no hay un modelo activo, y lo que usan los scripts de evaluación.
 */
export function configDesdeEntorno(): ConfigIa {
  const baseUrl = process.env.LLM_BASE_URL || BASE_URL_POR_DEFECTO;
  return {
    modeloId: null,
    proveedor: proveedorDeUrl(baseUrl),
    baseUrl,
    modelo: modeloActual(),
    apiKey: process.env.LLM_API_KEY || "",
    // Precios de gpt-oss-120b en Groq; LLM_USD_MILLON_* si el modelo es otro.
    usdMillonEntrada: numeroEnv("LLM_USD_MILLON_ENTRADA", 0.15),
    usdMillonSalida: numeroEnv("LLM_USD_MILLON_SALIDA", 0.6),
    origen: "entorno",
  };
}

/** "api.groq.com" → "groq". Solo para mostrar y agrupar. */
export function proveedorDeUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^(api|www)\./, "");
    if (host.includes("generativelanguage.googleapis.com")) return "google";
    return host.split(".").slice(-2, -1)[0] || host;
  } catch {
    return "desconocido";
  }
}

/**
 * Esfuerzo de razonamiento bajo para los modelos que lo aceptan. Se envía solo
 * a gpt-oss (o si LLM_REASONING_EFFORT está definida): otros proveedores
 * rechazan parámetros que no conocen.
 */
function parametrosRazonamiento(modelo: string): Record<string, string> {
  const esfuerzo = process.env.LLM_REASONING_EFFORT;
  if (esfuerzo) return { reasoning_effort: esfuerzo };
  return /gpt-oss/i.test(modelo) ? { reasoning_effort: "low" } : {};
}

export async function completar(params: {
  sistema: string;
  usuario: string;
  maxTokens?: number;
  timeoutMs?: number;
  config?: ConfigIa;
}): Promise<RespuestaModelo> {
  const config = params.config ?? configDesdeEntorno();
  const base = config.baseUrl.replace(/\/+$/, "");
  const modelo = config.modelo;
  const inicio = Date.now();

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      // Temperatura 0: en normativa, la creatividad es el defecto, no la virtud.
      temperature: 0,
      // gpt-oss y otros modelos de razonamiento gastan tokens "pensando" antes
      // de escribir, y esos tokens cuentan contra el tope. Con 700 el texto
      // podía llegar vacío; 1.500 deja margen para 200 palabras.
      max_tokens: params.maxTokens ?? 1500,
      ...parametrosRazonamiento(modelo),
      messages: [
        { role: "system", content: params.sistema },
        { role: "user", content: params.usuario },
      ],
    }),
    signal: AbortSignal.timeout(params.timeoutMs ?? 30_000),
  });

  if (!res.ok) {
    const espera = Number.parseFloat(res.headers.get("retry-after") ?? "");
    throw new ErrorProveedor(
      res.status,
      (await res.text()).slice(0, 500),
      Number.isFinite(espera) ? Math.ceil(espera) : null
    );
  }

  const datos = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };

  const tokensEntrada = datos.usage?.prompt_tokens ?? 0;
  const tokensSalida = datos.usage?.completion_tokens ?? 0;
  return {
    texto: datos.choices?.[0]?.message?.content?.trim() || "",
    modelo,
    proveedor: config.proveedor,
    costoUsd: (tokensEntrada * config.usdMillonEntrada + tokensSalida * config.usdMillonSalida) / 1_000_000,
    tokensEntrada,
    tokensSalida,
    tokensRazonamiento: datos.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
    latenciaMs: Date.now() - inicio,
  };
}
