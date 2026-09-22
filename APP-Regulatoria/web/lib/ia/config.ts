// Qué modelo de IA responde, elegido desde el panel y no desde el código.
//
// Cambiar de proveedor (por calidad o por costo) es: agregar el modelo al
// catálogo con sus precios, cargar su clave en Railway, PROBARLO desde el panel
// y activarlo. Sin deploy. El cobro se ajusta solo porque un crédito es un tope
// de costo (lib/planes.ts), y el histórico no se reescribe porque cada consulta
// guarda lo que costó con el precio del modelo que la respondió.
//
// Sin modelo activo en el panel (o si falta su clave), manda la configuración
// de siempre: LLM_API_KEY / LLM_BASE_URL / LLM_MODEL.
//
// Seguridad: la clave nunca se guarda en la base. La fila guarda el NOMBRE de
// la variable de entorno, y solo se aceptan nombres que terminan en _API_KEY:
// si no, el panel podría mandar BETTER_AUTH_SECRET a una URL cualquiera.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { configDesdeEntorno, proveedorDeUrl, type ConfigIa } from "@/lib/ia/proveedor";
import { creditosPorCosto, costoUsd } from "@/lib/planes";

export const ENV_CLAVE_VALIDA = /^[A-Z][A-Z0-9_]{0,60}_API_KEY$/;

/** Proveedores con API compatible con OpenAI. Solo URL y variable sugerida: los precios se escriben a mano. */
export const PRESETS: { proveedor: string; nombre: string; baseUrl: string; envClave: string }[] = [
  { proveedor: "groq", nombre: "Groq", baseUrl: "https://api.groq.com/openai/v1", envClave: "GROQ_API_KEY" },
  { proveedor: "openai", nombre: "OpenAI", baseUrl: "https://api.openai.com/v1", envClave: "OPENAI_API_KEY" },
  {
    proveedor: "google",
    nombre: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    envClave: "GEMINI_API_KEY",
  },
  { proveedor: "anthropic", nombre: "Anthropic", baseUrl: "https://api.anthropic.com/v1", envClave: "ANTHROPIC_API_KEY" },
  { proveedor: "deepseek", nombre: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", envClave: "DEEPSEEK_API_KEY" },
  { proveedor: "openrouter", nombre: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", envClave: "OPENROUTER_API_KEY" },
  { proveedor: "together", nombre: "Together", baseUrl: "https://api.together.xyz/v1", envClave: "TOGETHER_API_KEY" },
];

export interface ModeloIa {
  id: string;
  nombre: string;
  proveedor: string;
  baseUrl: string;
  modelo: string;
  envClave: string;
  usdMillonEntrada: number;
  usdMillonSalida: number;
  activo: boolean;
  notas: string | null;
  ultimaPrueba: PruebaModelo | null;
  /** ¿Existe la variable con la clave en este servidor? (Nunca el valor.) */
  claveCargada: boolean;
}

export interface PruebaModelo {
  fecha: string;
  ok: boolean;
  latenciaMs?: number;
  tokensEntrada?: number;
  tokensSalida?: number;
  costoUsd?: number;
  creditos?: number;
  extracto?: string;
  error?: string;
}

export function claveCargada(envClave: string): boolean {
  return ENV_CLAVE_VALIDA.test(envClave) && Boolean(process.env[envClave]);
}

interface FilaModelo {
  [campo: string]: unknown;
  id: string;
  nombre: string;
  proveedor: string;
  base_url: string;
  modelo: string;
  env_clave: string;
  usd_millon_entrada: number;
  usd_millon_salida: number;
  activo: boolean;
  notas: string | null;
  ultima_prueba: PruebaModelo | null;
}

function aModelo(f: FilaModelo): ModeloIa {
  return {
    id: f.id,
    nombre: f.nombre,
    proveedor: f.proveedor,
    baseUrl: f.base_url,
    modelo: f.modelo,
    envClave: f.env_clave,
    usdMillonEntrada: Number(f.usd_millon_entrada),
    usdMillonSalida: Number(f.usd_millon_salida),
    activo: f.activo,
    notas: f.notas,
    ultimaPrueba: f.ultima_prueba,
    claveCargada: claveCargada(f.env_clave),
  };
}

export function configDeModelo(m: ModeloIa): ConfigIa {
  return {
    modeloId: m.id,
    proveedor: m.proveedor,
    baseUrl: m.baseUrl,
    modelo: m.modelo,
    apiKey: ENV_CLAVE_VALIDA.test(m.envClave) ? process.env[m.envClave] || "" : "",
    usdMillonEntrada: m.usdMillonEntrada,
    usdMillonSalida: m.usdMillonSalida,
    origen: "panel",
  };
}

export async function listarModelos(): Promise<ModeloIa[]> {
  const { rows } = await db.execute<FilaModelo>(sql`
    SELECT * FROM modelos_ia ORDER BY activo DESC, proveedor, nombre
  `);
  return rows.map(aModelo);
}

async function modeloPorId(id: string): Promise<ModeloIa | null> {
  const { rows } = await db.execute<FilaModelo>(sql`SELECT * FROM modelos_ia WHERE id = ${id}`);
  return rows[0] ? aModelo(rows[0]) : null;
}

// Caché corta en memoria: /api/responder la consulta en cada redacción y la
// fila cambia una vez cada muchos meses. Se invalida al guardar desde el panel.
let cache: { valor: ConfigIa | null; hasta: number } | null = null;
const TTL_MS = 30_000;

export function invalidarConfigIa() {
  cache = null;
}

/**
 * La configuración con la que se redacta ahora. null = no hay IA disponible
 * (ni modelo activo con clave, ni LLM_API_KEY).
 */
export async function configIaActiva(): Promise<ConfigIa | null> {
  if (cache && cache.hasta > Date.now()) return cache.valor;

  let valor: ConfigIa | null = null;
  try {
    const { rows } = await db.execute<FilaModelo>(sql`SELECT * FROM modelos_ia WHERE activo = true LIMIT 1`);
    const activo = rows[0] ? aModelo(rows[0]) : null;
    if (activo?.claveCargada) {
      valor = configDeModelo(activo);
    } else {
      if (activo) console.warn(`[ia] modelo activo ${activo.id} sin clave (${activo.envClave}); uso LLM_*`);
      valor = await configEntornoConPrecios();
    }
  } catch (e) {
    // Sin base (o antes de 0009) la IA sigue con las variables de siempre.
    console.warn("[ia] no pude leer modelos_ia; uso LLM_*", e instanceof Error ? e.message : e);
    const env = configDesdeEntorno();
    valor = env.apiKey ? env : null;
  }
  cache = { valor, hasta: Date.now() + TTL_MS };
  return valor;
}

/**
 * Entorno, pero con los precios del catálogo si el modelo está ahí: así el
 * costo de cada consulta sale del mismo lugar que se edita en el panel.
 */
async function configEntornoConPrecios(): Promise<ConfigIa | null> {
  const env = configDesdeEntorno();
  if (!env.apiKey) return null;
  const { rows } = await db.execute<FilaModelo>(sql`
    SELECT * FROM modelos_ia WHERE modelo = ${env.modelo} AND rtrim(base_url, '/') = rtrim(${env.baseUrl}, '/') LIMIT 1
  `);
  if (!rows[0]) return env;
  const m = aModelo(rows[0]);
  return { ...env, modeloId: m.id, proveedor: m.proveedor, usdMillonEntrada: m.usdMillonEntrada, usdMillonSalida: m.usdMillonSalida };
}

export async function iaDisponible(): Promise<boolean> {
  return Boolean(await configIaActiva());
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export class ErrorModelo extends Error {}

export interface DatosModelo {
  id?: string;
  nombre: string;
  baseUrl: string;
  modelo: string;
  envClave: string;
  usdMillonEntrada: number;
  usdMillonSalida: number;
  notas?: string;
}

function validar(d: DatosModelo) {
  if (!d.nombre.trim() || !d.modelo.trim()) throw new ErrorModelo("Nombre y modelo son obligatorios.");
  let url: URL;
  try {
    url = new URL(d.baseUrl);
  } catch {
    throw new ErrorModelo("La URL base no es válida.");
  }
  if (url.protocol !== "https:") throw new ErrorModelo("La URL base tiene que ser https.");
  if (!ENV_CLAVE_VALIDA.test(d.envClave)) {
    throw new ErrorModelo("La variable de la clave tiene que llamarse algo como OPENAI_API_KEY (MAYÚSCULAS y terminar en _API_KEY).");
  }
  for (const p of [d.usdMillonEntrada, d.usdMillonSalida]) {
    if (!Number.isFinite(p) || p < 0 || p > 1_000) throw new ErrorModelo("Precios en US$ por millón de tokens, entre 0 y 1.000.");
  }
  if (d.usdMillonEntrada === 0 && d.usdMillonSalida === 0) {
    throw new ErrorModelo("Precio 0 en entrada y salida: el cobro quedaría sin base. Escribe el precio real (el del plan pagado, aunque uses el tier gratis).");
  }
}

function slug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function guardarModelo(d: DatosModelo): Promise<string> {
  validar(d);
  const proveedor = proveedorDeUrl(d.baseUrl);
  const id = d.id || slug(`${proveedor}-${d.modelo}`) || crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO modelos_ia (id, nombre, proveedor, base_url, modelo, env_clave, usd_millon_entrada, usd_millon_salida, notas)
    VALUES (${id}, ${d.nombre.trim()}, ${proveedor}, ${d.baseUrl.trim()}, ${d.modelo.trim()}, ${d.envClave},
      ${d.usdMillonEntrada}, ${d.usdMillonSalida}, ${d.notas?.trim() || null})
    ON CONFLICT (id) DO UPDATE SET
      nombre = EXCLUDED.nombre, proveedor = EXCLUDED.proveedor, base_url = EXCLUDED.base_url,
      modelo = EXCLUDED.modelo, env_clave = EXCLUDED.env_clave,
      usd_millon_entrada = EXCLUDED.usd_millon_entrada, usd_millon_salida = EXCLUDED.usd_millon_salida,
      notas = EXCLUDED.notas, updated_at = now(),
      -- Cambió el modelo o la URL: la prueba anterior ya no dice nada.
      ultima_prueba = CASE WHEN modelos_ia.modelo = EXCLUDED.modelo AND modelos_ia.base_url = EXCLUDED.base_url
                           THEN modelos_ia.ultima_prueba ELSE NULL END
  `);
  invalidarConfigIa();
  return id;
}

/**
 * Activa un modelo. Exige una prueba exitosa con la configuración actual y la
 * clave cargada: activar a ciegas un modelo que responde 401 dejaría a todos
 * sin IA hasta que alguien lo note.
 */
export async function activarModelo(id: string): Promise<void> {
  const m = await modeloPorId(id);
  if (!m) throw new ErrorModelo("Ese modelo no existe.");
  if (!m.claveCargada) throw new ErrorModelo(`Falta la variable ${m.envClave} en Railway.`);
  if (!m.ultimaPrueba?.ok) throw new ErrorModelo("Pruébalo primero: solo se activa un modelo con la última prueba exitosa.");
  await db.transaction(async (tx) => {
    await tx.execute(sql`UPDATE modelos_ia SET activo = false, updated_at = now() WHERE activo = true`);
    await tx.execute(sql`UPDATE modelos_ia SET activo = true, updated_at = now() WHERE id = ${id}`);
  });
  invalidarConfigIa();
}

/** Sin modelo activo: vuelven a mandar las variables LLM_*. */
export async function desactivarModelos(): Promise<void> {
  await db.execute(sql`UPDATE modelos_ia SET activo = false, updated_at = now() WHERE activo = true`);
  invalidarConfigIa();
}

export async function eliminarModelo(id: string): Promise<void> {
  const m = await modeloPorId(id);
  if (m?.activo) throw new ErrorModelo("No se puede borrar el modelo activo. Activa otro primero.");
  await db.execute(sql`DELETE FROM modelos_ia WHERE id = ${id}`);
}

/** Pregunta fija de la prueba: tiene respuesta en el corpus y exige citar. */
export const PREGUNTA_PRUEBA = "¿Qué requisitos tiene el rotulado de un medicamento en Chile?";

/**
 * Prueba de punta a punta: la misma recuperación, el mismo prompt y la misma
 * verificación que una consulta real, contra el modelo candidato. Guarda
 * latencia, tokens, costo, créditos que cobraría y un extracto.
 */
export async function probarModelo(id: string): Promise<PruebaModelo> {
  const m = await modeloPorId(id);
  if (!m) throw new ErrorModelo("Ese modelo no existe.");

  // Import tardío: el motor de búsqueda carga el corpus en memoria y no hace
  // falta para nada más de este archivo.
  const { responder } = await import("@/lib/search");
  const { pasajesDesdeRespuesta, redactarRespuesta } = await import("@/lib/ia/redactar");

  let prueba: PruebaModelo;
  if (!m.claveCargada) {
    prueba = { fecha: new Date().toISOString(), ok: false, error: `Falta la variable ${m.envClave} en el servidor.` };
  } else {
    try {
      const pasajes = pasajesDesdeRespuesta(responder(PREGUNTA_PRUEBA, { k: 6 }));
      const salida = await redactarRespuesta(PREGUNTA_PRUEBA, pasajes, configDeModelo(m));
      const r = salida.redaccion;
      const costo = costoUsd(salida.tokensEntrada, salida.tokensSalida, m);
      const problemas = [
        !r.texto && "respuesta vacía",
        r.citasInvalidas.length && "citó pasajes que no existen",
        r.sinCitas && !r.abstuvo && "no citó ningún pasaje",
        r.datosNoVerificados.length && `datos sin respaldo: ${r.datosNoVerificados.join(", ")}`,
      ].filter(Boolean) as string[];
      prueba = {
        fecha: new Date().toISOString(),
        ok: problemas.length === 0,
        latenciaMs: salida.latenciaMs,
        tokensEntrada: salida.tokensEntrada,
        tokensSalida: salida.tokensSalida,
        costoUsd: costo,
        creditos: creditosPorCosto(costo),
        extracto: r.texto.slice(0, 400),
        error: problemas.length ? problemas.join(" · ") : undefined,
      };
    } catch (e) {
      prueba = {
        fecha: new Date().toISOString(),
        ok: false,
        error: (e instanceof Error ? e.message : String(e)).slice(0, 400),
      };
    }
  }
  await db.execute(sql`
    UPDATE modelos_ia SET ultima_prueba = ${JSON.stringify(prueba)}::jsonb, updated_at = now() WHERE id = ${id}
  `);
  return prueba;
}

/** Tokens medios reales de los últimos 30 días, para estimar créditos por consulta de cada modelo. */
export async function consultaMedia(): Promise<{ entrada: number; salida: number; n: number }> {
  const { rows } = await db.execute<{ entrada: number | null; salida: number | null; n: number }>(sql`
    SELECT AVG(tokens_in)::float AS entrada, AVG(tokens_out)::float AS salida, COUNT(*)::int AS n
    FROM consultas WHERE tokens_in > 0 AND created_at > now() - interval '30 days'
  `);
  const r = rows[0];
  return r?.n ? { entrada: Number(r.entrada), salida: Number(r.salida), n: r.n } : { entrada: 2_500, salida: 160, n: 0 };
}
