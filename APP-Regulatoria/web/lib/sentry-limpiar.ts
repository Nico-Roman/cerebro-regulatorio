// Lo que NO puede salir hacia Sentry (encargo E): el texto de las preguntas, lo
// pegado en un flujo y el cuerpo de cualquier solicitud. Un error del servidor
// sirve igual sin ellos —stack, ruta y versión bastan para diagnosticar— y una
// pregunta puede traer datos de un expediente o de un paciente.
//
// Puro y sin dependencias: lo usan las tres configuraciones de Sentry y las
// pruebas.

type Dict = Record<string, unknown>;

/** La URL sin query string ni fragmento: `?q=` lleva la pregunta. */
export function urlSinConsulta(url: unknown): unknown {
  if (typeof url !== "string") return url;
  return url.split(/[?#]/)[0];
}

export function limpiarEvento<T>(evento: T): T {
  const e = evento as Dict;
  const req = e.request as Dict | undefined;
  if (req) {
    delete req.data;
    delete req.query_string;
    delete req.cookies;
    req.url = urlSinConsulta(req.url);
    const h = req.headers as Dict | undefined;
    if (h) for (const k of Object.keys(h)) if (/cookie|authorization/i.test(k)) delete h[k];
  }
  delete e.extra;
  const migas = e.breadcrumbs as Dict[] | undefined;
  if (Array.isArray(migas)) e.breadcrumbs = migas.map((m) => limpiarMiga(m)).filter(Boolean);
  return evento;
}

/** Migas de navegación y de fetch sin cuerpos ni consultas. Las de consola, fuera. */
export function limpiarMiga<T>(miga: T): T | null {
  const m = miga as Dict;
  if (m.category === "console") return null;
  const data = m.data as Dict | undefined;
  if (data) {
    delete data.body;
    delete data.request_body;
    delete data.response_body;
    for (const k of ["url", "from", "to"]) if (k in data) data[k] = urlSinConsulta(data[k]);
  }
  if (typeof m.message === "string" && /[?#]/.test(m.message)) m.message = urlSinConsulta(m.message);
  return miga;
}
