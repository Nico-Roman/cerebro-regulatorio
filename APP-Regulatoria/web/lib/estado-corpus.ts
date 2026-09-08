// Frescura del corpus.
//
// Un buscador de normativa que sirve texto legal de hace tres meses sin
// decirlo es peor que uno caído: el usuario no tiene cómo saber que le están
// respondiendo con regulación vieja. Este módulo existe para que la edad del
// corpus sea un dato de primera clase y no algo que haya que deducir.
//
// El archivo lo escribe el pipeline (actualizar-diario.js, paso 6) junto con
// el corpus, así que la fecha corresponde siempre al índice que está cargado.

import fs from "node:fs";
import path from "node:path";

export type EstadoCorpus = {
  generado: string | null;
  snapshotFetchedAt: string | null;
  documentos: number | null;
  normasListadoOficial: number | null;
  publicadoPor: string | null;
  diasDesdeGeneracion: number | null;
  fresco: boolean;
  vencido: boolean;
};

// Umbrales. El pipeline corre a diario: 3 días ya significa que algo falló dos
// veces seguidas, y 7 que lleva una semana muerto.
export const DIAS_AVISO = 3;
export const DIAS_VENCIDO = 7;

let cache: EstadoCorpus | null = null;

export function estadoCorpus(): EstadoCorpus {
  // Sin caché entre peticiones el disco se lee en cada request; el archivo solo
  // cambia con un despliegue nuevo, así que cachear es correcto.
  if (cache) return cache;

  let datos: Record<string, unknown> = {};
  try {
    const file = path.join(process.cwd(), "data", "estado-corpus.json");
    datos = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    // Falta el archivo: no se finge frescura. Un corpus sin fecha se trata como
    // vencido, porque no poder demostrar que está al día es exactamente el
    // problema que este módulo resuelve.
    datos = {};
  }

  const generado = typeof datos.generado === "string" ? datos.generado : null;
  const dias = generado ? diasDesde(generado) : null;

  cache = {
    generado,
    snapshotFetchedAt:
      typeof datos.snapshot_fetched_at === "string" ? datos.snapshot_fetched_at : null,
    documentos: typeof datos.documentos === "number" ? datos.documentos : null,
    normasListadoOficial:
      typeof datos.normas_listado_oficial === "number" ? datos.normas_listado_oficial : null,
    publicadoPor: typeof datos.publicado_por === "string" ? datos.publicado_por : null,
    diasDesdeGeneracion: dias,
    fresco: dias !== null && dias <= DIAS_AVISO,
    vencido: dias === null || dias > DIAS_VENCIDO,
  };
  return cache;
}

function diasDesde(fecha: string): number | null {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

/** "30-08-2026" a partir de "2026-08-30", sin depender de la zona del servidor. */
export function fechaLegible(iso: string | null): string {
  if (!iso) return "fecha desconocida";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso.slice(0, 10);
}
