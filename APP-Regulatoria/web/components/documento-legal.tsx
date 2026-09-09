// Envoltorio de los documentos legales (privacidad, términos). Existe para que
// ambos compartan jerarquía tipográfica y numeración sin duplicar el JSX: son
// textos que se leen poco y se citan mucho, así que la numeración de sección es
// parte de la utilidad, no decoración.

import type { ReactNode } from "react";

export function DocumentoLegal({
  etiqueta,
  titulo,
  bajada,
  actualizado,
  children,
}: {
  etiqueta: string;
  titulo: string;
  bajada: string;
  actualizado: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <p className="label-micro text-muted">{etiqueta}</p>
        <h1 className="font-display mt-3 text-3xl leading-tight tracking-tight sm:text-4xl">
          {titulo}
        </h1>
        <p className="mt-5 leading-relaxed text-muted">{bajada}</p>
        <p className="label-micro mt-6 text-muted">Vigente desde {actualizado}</p>

        <div className="mt-14 flex flex-col gap-12">{children}</div>
      </div>
    </main>
  );
}

export function Seccion({
  n,
  titulo,
  children,
}: {
  n: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3 border-b border-line pb-3">
        <span className="label-micro text-muted">{n}</span>
        <h2 className="font-display text-lg tracking-tight sm:text-xl">{titulo}</h2>
      </div>
      <div className="flex flex-col gap-4 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

/** Lista de puntos. Se usa solo donde el contenido es realmente un inventario
 *  (categorías de datos, terceros), no para trocear prosa. */
export function Puntos({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-line" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
