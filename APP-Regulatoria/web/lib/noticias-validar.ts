// Reglas de forma de una noticia. Módulo puro, sin la importación del JSON,
// para que la prueba (`node --test`) lo pueda cargar tal cual.
//
// Las mismas reglas están copiadas en el nodo «Armar archivo» del flujo de n8n
// (n8n/noticias-regulamed.json): n8n valida el archivo completo antes de
// publicarlo y esta copia lo vuelve a validar en CI y al compilar. Si se cambia
// una regla acá, hay que cambiarla allá.

import type { CategoriaNoticia, Noticia } from "./noticias-tipos.ts";

export const CATEGORIAS_VALIDAS: readonly CategoriaNoticia[] = [
  "farmaceuticos",
  "cosmeticos",
  "suplementos",
  "dispositivos",
];

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaIso(v: unknown): v is string {
  if (typeof v !== "string" || !FECHA_ISO.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Devuelve la lista de problemas de una noticia; vacía si está bien. */
export function problemasNoticia(n: unknown): string[] {
  if (!n || typeof n !== "object") return ["no es un objeto"];
  const o = n as Record<string, unknown>;
  const p: string[] = [];

  if (typeof o.titulo !== "string" || o.titulo.trim().length < 10 || o.titulo.length > 240)
    p.push("titulo: texto de 10 a 240 caracteres");
  if (o.resumen !== undefined && (typeof o.resumen !== "string" || o.resumen.length > 500))
    p.push("resumen: texto de hasta 500 caracteres");
  if (o.destacada === true && (typeof o.resumen !== "string" || !o.resumen.trim()))
    p.push("resumen: obligatorio en las destacadas");
  if (!CATEGORIAS_VALIDAS.includes(o.categoria as CategoriaNoticia))
    p.push(`categoria: una de ${CATEGORIAS_VALIDAS.join(", ")}`);
  if (o.ambito !== "Chile" && o.ambito !== "Internacional")
    p.push("ambito: Chile o Internacional");
  if (!esFechaIso(o.fecha)) p.push("fecha: AAAA-MM-DD");
  if (typeof o.fuente !== "string" || !o.fuente.trim() || o.fuente.length > 40)
    p.push("fuente: texto de 1 a 40 caracteres");
  try {
    if (typeof o.url !== "string" || new URL(o.url).protocol !== "https:") throw 0;
  } catch {
    p.push("url: https://…");
  }
  if (o.destacada !== undefined && typeof o.destacada !== "boolean")
    p.push("destacada: true o false");
  if (o.origen !== undefined && o.origen !== "manual" && o.origen !== "n8n")
    p.push("origen: manual o n8n");

  return p;
}

export function esNoticiaValida(n: unknown): n is Noticia {
  return problemasNoticia(n).length === 0;
}

/** Problemas del archivo completo: forma de cada nota + URLs repetidas. */
export function problemasArchivo(datos: unknown): string[] {
  if (!datos || typeof datos !== "object") return ["el archivo no es un objeto"];
  const o = datos as Record<string, unknown>;
  const p: string[] = [];

  if (!esFechaIso(o.actualizadas)) p.push("actualizadas: AAAA-MM-DD");
  if (!Array.isArray(o.noticias)) return [...p, "noticias: falta la lista"];

  const vistas = new Set<string>();
  o.noticias.forEach((n, i) => {
    for (const x of problemasNoticia(n)) p.push(`noticias[${i}] ${x}`);
    const url = (n as Record<string, unknown>)?.url;
    if (typeof url === "string") {
      if (vistas.has(url)) p.push(`noticias[${i}] url repetida: ${url}`);
      vistas.add(url);
    }
  });

  return p;
}
