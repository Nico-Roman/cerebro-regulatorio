// Configuración del video de venta (VSL) de la página de asesoría.
//
// El id del video vive en una variable de entorno y no en el código a
// propósito: cambiar el video —o reemplazarlo por una versión nueva grabada en
// tres meses— no debería ser un commit, un build y un deploy. Mientras la
// variable esté vacía, la página muestra un marcador de posición en vez de un
// reproductor roto, así que /asesoria se puede publicar antes de tener el video.
//
// Ojo con `||` en vez de `??`: en el build de Docker un ARG no pasado deja la
// variable como cadena vacía, no como undefined (ver lib/site.ts).

export const VSL = {
  /**
   * Id del video de YouTube: los 11 caracteres que van después de `v=` en la
   * URL. De `https://www.youtube.com/watch?v=dQw4w9WgXcQ` el id es
   * `dQw4w9WgXcQ`. Súbelo como "No listado" (Oculto): no aparece en búsquedas
   * ni en tu canal, pero cualquiera con el enlace —o con la página— lo ve.
   */
  youtubeId: process.env.NEXT_PUBLIC_VSL_YOUTUBE_ID || "",

  /** Título accesible del reproductor. Lo leen los lectores de pantalla. */
  titulo: "Cómo trabajo los asuntos regulatorios contigo",

  /** Duración declarada, para que el visitante sepa a qué se compromete. */
  duracion: "6 minutos",

  /**
   * Lo que el video cubre. Sirve para dos cosas: le dice al visitante que no
   * está entrando a un video de relleno, y alimenta el schema VideoObject.
   */
  puntos: [
    "Qué problema regulatorio resuelvo y cuál no",
    "Cómo es el proceso, paso a paso, desde la primera llamada",
    "Mi trayectoria y por qué la operación logística importa en regulatorio",
    "Qué cuesta, cómo se cobra y qué pasa si el ISP observa el expediente",
  ],

  /**
   * Descripción para los datos estructurados de Google. Si algún día el video
   * pasa a ser público, esto es lo que puede hacer que aparezca con miniatura
   * en el resultado de búsqueda.
   */
  descripcion:
    "Presentación de los servicios de asesoría regulatoria de RegulaMED para " +
    "laboratorios, importadores y marcas que necesitan registrar o mantener " +
    "productos farmacéuticos, cosméticos y dispositivos médicos ante el ISP/ANAMED de Chile.",

  /**
   * Fecha de publicación en ISO. Google la pide en el schema VideoObject.
   * Actualízala cuando grabes una versión nueva.
   */
  publicado: "2026-09-14",
} as const;

export function vslConfigurado(): boolean {
  // Los ids de YouTube son 11 caracteres de [A-Za-z0-9_-]. Validar el formato
  // evita que una URL pegada entera ("https://youtu.be/...") se convierta en un
  // iframe que carga una página de error dentro de la landing.
  return /^[A-Za-z0-9_-]{11}$/.test(VSL.youtubeId);
}

/** Miniatura oficial del video. `hqdefault` existe siempre; `maxresdefault` no. */
export function miniaturaUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * URL del reproductor incrustado.
 *
 * Los parámetros no son decorativos:
 * - `rel=0` evita que al terminar aparezcan videos de otros canales, que es la
 *   forma más rápida de perder a alguien que estaba a punto de contactarte.
 * - `modestbranding=1` reduce la marca de YouTube sobre el reproductor.
 * - `playsinline=1` impide que iOS se lleve el video a pantalla completa y saque
 *   al visitante de la página.
 * - `autoplay=1` solo aplica cuando el iframe se inserta tras un clic, que es
 *   como funciona acá: el navegador lo permite porque hubo gesto del usuario.
 * - `youtube-nocookie.com` no deja cookies de seguimiento hasta que el video se
 *   reproduce, que es lo que promete la política de privacidad del sitio.
 */
export function embedUrl(id: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}
