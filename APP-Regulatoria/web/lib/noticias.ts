// Noticias del sector: farmacéuticos, cosméticos, suplementos y dispositivos
// médicos, en Chile y afuera.
//
// Es una selección, no un agregador: cada nota se lee en su fuente antes de
// entrar y el resumen dice solo lo que dice la fuente. El titular enlaza
// siempre a la nota original, que es donde está la información completa.
//
// DE DÓNDE SALEN
//
//   Los datos viven en data/noticias.json. Los escribe a diario el flujo de n8n
//   «RegulaMED · Noticias» (n8n/noticias-regulamed.json en la raíz del repo):
//   lee los feeds oficiales y busca en medios, abre cada nota, resume con IA a
//   partir del texto de la nota y descarta lo que no pasa las validaciones
//   (por ejemplo, un número en el resumen que no aparece en la nota). Publica
//   con un commit a main, lo que dispara el deploy de Railway.
//
// AGREGAR UNA A MANO
//
//   · Agregarla arriba de "noticias" en data/noticias.json, con su fecha de
//     publicación en la fuente (no la fecha en que se agregó) y
//     "origen": "manual". n8n nunca borra ni edita las existentes.
//   · Las tres del cuadro principal llevan "destacada": true. Si hay más de
//     tres, salen las tres más recientes.
//   · Preferir la fuente oficial (ISP, Minsal, FDA, EMA) cuando la nota existe
//     ahí; un medio solo cuando la autoridad no publicó nota propia.
//   · `npm test` valida el archivo (tests/noticias.test.mts).

import datos from "@/data/noticias.json";
import type { CategoriaNoticia, Noticia, RevisionNoticias } from "./noticias-tipos";
import { esFechaIso, esNoticiaValida, problemasNoticia } from "./noticias-validar";

export type { CategoriaNoticia, Noticia, RevisionNoticias };

export const CATEGORIAS: Record<CategoriaNoticia, string> = {
  farmaceuticos: "Farmacéuticos",
  cosmeticos: "Cosméticos",
  suplementos: "Suplementos",
  dispositivos: "Dispositivos médicos",
};

const crudo = datos as unknown as {
  actualizadas?: unknown;
  revision?: RevisionNoticias | null;
  noticias?: unknown[];
};

// Una nota mal formada no puede botar la página: se deja fuera y se avisa en el
// log del build. CI (npm test) ya habría puesto el commit en rojo.
export const NOTICIAS: Noticia[] = [];
(crudo.noticias ?? []).forEach((n, i) => {
  if (esNoticiaValida(n)) NOTICIAS.push(n);
  else console.warn(`[noticias] se omite noticias[${i}]: ${problemasNoticia(n).join("; ")}`);
});

/** Día de la última revisión de la selección completa (la escribe n8n en cada corrida). */
export const ACTUALIZADAS: string = esFechaIso(crudo.actualizadas)
  ? crudo.actualizadas
  : (NOTICIAS.map((n) => n.fecha).sort().at(-1) ?? "2026-10-07");

/** Bitácora de la última corrida automática, o null si nunca corrió. */
export const REVISION: RevisionNoticias | null = crudo.revision ?? null;

const porFechaDesc = (a: Noticia, b: Noticia) => b.fecha.localeCompare(a.fecha);

/** Las tres del cuadro principal, de la más reciente a la más antigua. */
export function noticiasDestacadas(): Noticia[] {
  return NOTICIAS.filter((n) => n.destacada).sort(porFechaDesc).slice(0, 3);
}

/** Todos los titulares que no van en el cuadro principal. */
export function titulares(): Noticia[] {
  const destacadas = new Set(noticiasDestacadas());
  return NOTICIAS.filter((n) => !destacadas.has(n)).sort(porFechaDesc);
}

export function fechaNoticia(iso: string, mes: "long" | "short" = "long"): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", {
    day: "numeric",
    month: mes,
    year: "numeric",
  });
}
