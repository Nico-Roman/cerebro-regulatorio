// Caché de disponibilidad, en memoria del proceso.
//
// Vive en lib/ y no dentro de la ruta a propósito: un route.ts solo puede
// exportar métodos HTTP, así que compartir estado entre rutas exige un módulo
// aparte. Al ser memoria del contenedor, si algún día hay más de una réplica
// cada una tendrá la suya — con 60 segundos de vida eso no genera conflictos,
// porque la reserva revalida el hueco contra Google antes de confirmar.

interface Entrada {
  hasta: number;
  datos: unknown;
}

let entrada: Entrada | null = null;

export const CACHE_MS = 60_000;

export function leerCacheHuecos(): unknown | null {
  if (entrada && entrada.hasta > Date.now()) return entrada.datos;
  return null;
}

export function guardarCacheHuecos(datos: unknown): void {
  entrada = { hasta: Date.now() + CACHE_MS, datos };
}

export function invalidarCacheHuecos(): void {
  entrada = null;
}
