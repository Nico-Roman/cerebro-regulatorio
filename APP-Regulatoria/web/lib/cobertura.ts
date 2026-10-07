// Qué normas incluye la base (página /cobertura, encargo E). Se arma desde el
// mismo data/corpus.jsonl que sirve el buscador, así que no puede desalinearse
// de lo que de verdad se busca.

import fs from "node:fs";
import path from "node:path";
import { etiquetaCategoria, formatoNumero, loadCorpus, type CorpusChunk } from "@/lib/search";

export interface NormaCubierta {
  normaId: string;
  nombre: string;
  tipo: string;
  numero: string;
  fecha: string;
  titulo: string;
  materias: string[];
  enlace: string;
  vigencia: string;
}

/** El enlace de la norma, no el de un artículo: sin `&idParte=` de la BCN. */
function enlaceNorma(url: string): string {
  return url.replace(/[&?]idParte=\d+/, "");
}

export function normasCubiertas(filas: CorpusChunk[] = loadCorpus()): NormaCubierta[] {
  const porNorma = new Map<string, NormaCubierta>();
  for (const r of filas) {
    const id = r.norma_id || r.doc_id;
    let n = porNorma.get(id);
    if (!n) {
      const numero = formatoNumero(r.numero || "");
      n = {
        normaId: id,
        // El Código Sanitario se indexa por Libro; se lista una vez, por su nombre.
        nombre: r.categoria === "codigo_sanitario" ? "Código Sanitario" : [r.tipo, numero].filter(Boolean).join(" "),
        tipo: r.tipo || "",
        numero,
        fecha: r.fecha || "",
        titulo: r.categoria === "codigo_sanitario" ? "DFL 725 de 1967, texto refundido de la BCN" : r.titulo || "",
        materias: [],
        enlace: enlaceNorma(r.fuente_url || ""),
        vigencia: r.vigencia || "",
      };
      porNorma.set(id, n);
    }
    for (const c of r.categorias?.length ? r.categorias : [r.categoria]) {
      const e = etiquetaCategoria(c);
      if (c && !n.materias.includes(e)) n.materias.push(e);
    }
  }
  return [...porNorma.values()].sort(
    (a, b) => a.materias[0].localeCompare(b.materias[0], "es") || a.nombre.localeCompare(b.nombre, "es", { numeric: true })
  );
}

/**
 * Materias que la base declara fuera de alcance (vocabulario.json). Una regla
 * con `salvo_categoria` deja de figurar cuando el corpus ya trae esa materia.
 */
export function materiasNoIncluidas(filas: CorpusChunk[] = loadCorpus()): string[] {
  const voc = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "vocabulario.json"), "utf-8")) as {
    fuera_de_alcance?: Array<{ materia: string; salvo_categoria?: string }>;
  };
  const presentes = new Set(filas.flatMap((r) => (r.categorias?.length ? r.categorias : [r.categoria])));
  return (voc.fuera_de_alcance || [])
    .filter((r) => !(r.salvo_categoria && presentes.has(r.salvo_categoria)))
    .map((r) => r.materia);
}
