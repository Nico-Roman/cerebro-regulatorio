import type { Metadata } from "next";
import { OG_IMAGEN, SITE } from "@/lib/site";
import {
  ACTUALIZADAS,
  CATEGORIAS,
  fechaNoticia,
  noticiasDestacadas,
  titulares,
  type Noticia,
} from "@/lib/noticias";

export const metadata: Metadata = {
  title: "Noticias regulatorias",
  description:
    "Lo último en regulación de medicamentos, cosméticos, suplementos y dispositivos médicos en Chile y el mundo, con enlace a cada fuente.",
  alternates: { canonical: "/noticias" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: `${SITE.url}/noticias`,
    siteName: SITE.nombre,
    title: `Noticias regulatorias · ${SITE.nombre}`,
    description:
      "Medicamentos, cosméticos, suplementos y dispositivos médicos: lo que cambió, con la fuente a un clic.",
    images: [OG_IMAGEN],
  },
};

function Etiquetas({ n }: { n: Noticia }) {
  return (
    <span className="label-micro text-muted">
      <span className="text-accent">{CATEGORIAS[n.categoria]}</span>
      {" · "}
      {n.ambito}
    </span>
  );
}

export default function Noticias() {
  const destacadas = noticiasDestacadas();
  const resto = titulares();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <span className="label-micro text-muted">Noticias</span>

      <h1 className="font-display mt-5 max-w-3xl text-[2rem] leading-[1.1] font-medium tracking-tight sm:text-5xl">
        Lo que se movió en el sector.
      </h1>

      <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
        Medicamentos, cosméticos, suplementos y dispositivos médicos, en Chile y afuera.
        Cada titular lleva a la nota original.
      </p>

      <p className="label-micro mt-7 text-muted">Actualizado el {fechaNoticia(ACTUALIZADAS)}</p>

      {/* Cuadro principal: las tres noticias que más mueven el trabajo
          regulatorio de la semana. */}
      <section aria-labelledby="destacadas" className="mt-14">
        <h2 id="destacadas" className="label-micro flex items-center gap-2.5 text-foreground">
          <span className="punto-neon" aria-hidden />
          Lo más importante
        </h2>

        <div className="mt-5 grid gap-px border border-line bg-line shadow-neon-suave lg:grid-cols-3">
          {destacadas.map((n, i) => (
            <article key={n.url} className="bg-background transition-colors hover:bg-surface">
              <a
                href={n.url}
                target="_blank"
                rel="noreferrer"
                className="flex h-full flex-col gap-4 p-7"
              >
                <span className="font-display text-3xl font-medium text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Etiquetas n={n} />
                <h3 className="font-display text-lg leading-snug font-medium tracking-tight sm:text-xl">
                  {n.titulo}
                </h3>
                {n.resumen && <p className="text-sm leading-relaxed text-muted">{n.resumen}</p>}
                <span className="label-micro mt-auto pt-3 text-muted">
                  {n.fuente} · {fechaNoticia(n.fecha, "short")} ↗
                </span>
              </a>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="titulares" className="mt-20">
        <h2 id="titulares" className="label-micro text-muted">
          Más titulares
        </h2>

        <ul className="mt-5 border-t border-line">
          {resto.map((n) => (
            <li key={n.url} className="border-b border-line">
              <a
                href={n.url}
                target="_blank"
                rel="noreferrer"
                className="group grid gap-2 py-5 sm:grid-cols-[9rem_1fr] sm:gap-8"
              >
                <time dateTime={n.fecha} className="label-micro pt-1 text-muted">
                  {fechaNoticia(n.fecha, "short")}
                </time>
                <div className="flex flex-col gap-2">
                  <Etiquetas n={n} />
                  <span className="font-display text-base leading-snug font-medium tracking-tight group-hover:text-accent sm:text-lg">
                    {n.titulo}
                  </span>
                  {n.resumen && (
                    <span className="text-sm leading-relaxed text-muted">{n.resumen}</span>
                  )}
                  <span className="label-micro text-muted">{n.fuente} ↗</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-14 max-w-2xl text-xs leading-relaxed text-muted">
        Selección editorial de {SITE.nombre}. Los resúmenes reproducen lo que informa cada
        fuente; antes de tomar una decisión, lee la nota completa y confirma en la fuente
        oficial.
      </p>
    </main>
  );
}
