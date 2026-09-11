// Destino de redirección después de ingresar o completar el perfil.
//
// Solo se aceptan rutas internas. "/\evil.com" pasaba el filtro anterior (empieza
// con "/" y no con "//"), pero los navegadores tratan la barra invertida como
// barra normal y lo convierten en "//evil.com": un open redirect. Tampoco se
// aceptan caracteres de control, que algunos navegadores descartan antes de
// interpretar la URL.

function caracterNoPermitido(ch: string): boolean {
  const codigo = ch.charCodeAt(0);
  return ch === "\\" || codigo < 32 || codigo === 127;
}

export function destinoSeguro(next?: string | null, porDefecto = "/normativa"): string {
  if (!next || typeof next !== "string") return porDefecto;
  if (!next.startsWith("/") || next.startsWith("//")) return porDefecto;
  if ([...next].some(caracterNoPermitido)) return porDefecto;
  return next;
}
