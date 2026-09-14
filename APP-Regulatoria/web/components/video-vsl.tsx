"use client";

import Image from "next/image";
import { useState } from "react";
import { VSL, embedUrl, miniaturaUrl, vslConfigurado } from "@/lib/vsl";

/**
 * Reproductor del VSL con carga diferida.
 *
 * Por qué no un `<iframe>` de YouTube directo: el reproductor incrustado trae
 * del orden de un megabyte de JavaScript y varias conexiones a dominios de
 * Google en cuanto la página carga, lo vea alguien o no. En una landing cuyo
 * trabajo es que la persona llegue al formulario, eso es pagar el costo
 * completo por adelantado para la mayoría que nunca le va a dar play.
 *
 * Acá se muestra la miniatura oficial del video —una sola imagen— y el iframe
 * se inserta recién al primer clic, ya con autoplay: para el visitante el
 * comportamiento es idéntico, y el que no lo mira no paga nada.
 */
export function VideoVsl() {
  const [reproduciendo, setReproduciendo] = useState(false);

  if (!vslConfigurado()) return <MarcadorPendiente />;

  const id = VSL.youtubeId;

  return (
    <figure className="m-0">
      <div className="relative aspect-video w-full overflow-hidden border border-line bg-surface">
        {reproduciendo ? (
          <iframe
            src={embedUrl(id)}
            title={VSL.titulo}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setReproduciendo(true)}
            aria-label={`Reproducir: ${VSL.titulo} (${VSL.duracion})`}
            className="group absolute inset-0 h-full w-full cursor-pointer"
          >
            <Image
              src={miniaturaUrl(id)}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover opacity-70 transition-opacity duration-300 group-hover:opacity-90"
              // La miniatura es decorativa: el texto accesible lo da aria-label
              // del botón, así que un alt vacío evita que se lea dos veces.
              unoptimized
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-foreground/40 bg-background/80 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 sm:h-20 sm:w-20">
                <Triangulo />
              </span>
            </span>
            <span className="label-micro absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-background to-transparent px-4 pb-4 pt-10 text-left text-muted">
              <span className="text-foreground">{VSL.titulo}</span>
              <span>{VSL.duracion}</span>
            </span>
          </button>
        )}
      </div>

      <figcaption className="mt-4 text-xs leading-relaxed text-muted">
        El reproductor de YouTube se carga solo cuando aprietas play, y sin
        cookies de seguimiento. Antes de eso, lo único que se pide a un servidor
        de Google es la imagen de portada.
      </figcaption>
    </figure>
  );
}

/**
 * Estado sin video configurado.
 *
 * Deliberadamente visible y con instrucciones en vez de un bloque vacío: así la
 * página se puede publicar antes de tener el video grabado, y el hueco no se
 * olvida. En cuanto NEXT_PUBLIC_VSL_YOUTUBE_ID tenga un id válido, este bloque
 * desaparece solo.
 */
function MarcadorPendiente() {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 border border-dashed border-line bg-surface p-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line">
        <Triangulo />
      </span>
      <p className="font-display text-base font-medium sm:text-lg">
        Video pendiente de publicación
      </p>
      <p className="max-w-sm text-xs leading-relaxed text-muted">
        Sube el video a YouTube como <strong className="text-foreground">No listado</strong> y
        define la variable{" "}
        <code className="font-mono text-[0.7rem] text-foreground">
          NEXT_PUBLIC_VSL_YOUTUBE_ID
        </code>{" "}
        con los 11 caracteres del enlace. El reproductor aparece en el siguiente
        despliegue, sin tocar código.
      </p>
    </div>
  );
}

function Triangulo() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="ml-0.5 h-6 w-6 fill-foreground sm:h-7 sm:w-7"
    >
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.1-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}
