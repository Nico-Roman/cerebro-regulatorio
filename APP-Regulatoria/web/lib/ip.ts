// IP del cliente para límites de uso.
//
// El primer valor de X-Forwarded-For lo escribe el propio cliente, así que
// alcanzaba con mandar una cabecera distinta en cada request para saltarse el
// tope de reservas. Railway agrega la IP real al FINAL de la cadena (y la deja
// en X-Real-IP), así que se toma esa.

export function ipCliente(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const cadena = (headers.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return cadena.length ? cadena[cadena.length - 1] : "sin-ip";
}
