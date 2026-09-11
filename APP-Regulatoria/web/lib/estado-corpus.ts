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
  // Versión del texto refundido del Código Sanitario que trae este corpus.
  // Es una frescura distinta de la del corpus: el corpus puede regenerarse hoy
  // y aun así traer una ley vieja si la descarga de la BCN vino de caché.
  codigoSanitarioVersion: string | null;
  diasDesdeGeneracion: number | null;
  fresco: boolean;
  vencido: boolean;
};

// Umbrales. El pipeline corre a diario: 3 días ya significa que algo falló dos
// veces seguidas, y 7 que lleva una semana muerto.
export const DIAS_AVISO = 3;
export const DIAS_VENCIDO = 7;

// Solo se guarda en caché lo que el archivo DICE (fecha, conteos). La edad se
// calcula en cada llamada.
//
// Antes se cacheaba el objeto completo, días incluidos, al primer request. Si el
// pipeline dejaba de correr no había commit, ni redeploy, ni proceso nuevo: el
// contenedor seguía respondiendo "fresco" para siempre y ni /api/estado ni el
// aviso del buscador podían detectar el atraso. Se comprobó en producción el
// 11-09-2026: 26 horas después de generado el corpus, /api/estado decía 0 días.
type DatosArchivo = Omit<EstadoCorpus, "diasDesdeGeneracion" | "fresco" | "vencido">;

let cache: DatosArchivo | null = null;

function leerArchivo(): DatosArchivo {
  // El archivo solo cambia con un despliegue nuevo, así que leerlo una vez por
  // proceso es correcto.
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

  cache = {
    generado: typeof datos.generado === "string" ? datos.generado : null,
    snapshotFetchedAt:
      typeof datos.snapshot_fetched_at === "string" ? datos.snapshot_fetched_at : null,
    documentos: typeof datos.documentos === "number" ? datos.documentos : null,
    normasListadoOficial:
      typeof datos.normas_listado_oficial === "number" ? datos.normas_listado_oficial : null,
    publicadoPor: typeof datos.publicado_por === "string" ? datos.publicado_por : null,
    codigoSanitarioVersion: leerVersionLey(datos.codigo_sanitario),
  };
  return cache;
}

export function estadoCorpus(ahora: number = Date.now()): EstadoCorpus {
  const datos = leerArchivo();
  const dias = datos.generado ? diasDesde(datos.generado, ahora) : null;
  return {
    ...datos,
    diasDesdeGeneracion: dias,
    fresco: dias !== null && dias <= DIAS_AVISO,
    vencido: dias === null || dias > DIAS_VENCIDO,
  };
}

function leerVersionLey(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const ver = (v as Record<string, unknown>).version_refundida;
  return typeof ver === "string" ? ver : null;
}

function diasDesde(fecha: string, ahora: number): number | null {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((ahora - d.getTime()) / 86_400_000);
}

/** "30-08-2026" a partir de "2026-08-30", sin depender de la zona del servidor. */
export function fechaLegible(iso: string | null): string {
  if (!iso) return "fecha desconocida";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso.slice(0, 10);
}
