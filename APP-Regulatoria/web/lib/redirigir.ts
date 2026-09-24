// Redirección después de un POST de formulario (patrón POST → 303 → GET).
//
// NO usar `NextResponse.redirect(new URL(ruta, req.url))`: en Railway la app
// corre en modo standalone escuchando en 0.0.0.0:8080 detrás del proxy, y
// `req.url` en un route handler trae ESA dirección interna, no regulamed.cl. El
// navegador terminaba en "can't connect to 0.0.0.0:8080" al guardar la agenda
// (reportado el 22-09-2026).
//
// Un Location relativo (permitido desde RFC 7231) lo resuelve el navegador
// contra la URL en la que ya está, así que funciona igual en producción, en
// local y detrás de cualquier proxy, sin depender de cabeceras X-Forwarded-*.

/** 303 a una ruta interna del sitio. Solo acepta rutas que empiezan con "/" (no "//"). */
export function redirigir(ruta: string): Response {
  const segura = /^\/(?!\/)/.test(ruta) && !/[\r\n]/.test(ruta) ? ruta : "/";
  return new Response(null, { status: 303, headers: { Location: segura } });
}
