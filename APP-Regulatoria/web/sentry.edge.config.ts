// Sentry en el runtime edge (proxy.ts). Sin SENTRY_DSN no se inicializa: el sitio
// funciona igual y no sale nada. Ver lib/sentry-limpiar.ts.
import * as Sentry from "@sentry/nextjs";
import { limpiarEvento, limpiarMiga } from "@/lib/sentry-limpiar";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV,
    // Solo errores: sin trazas de rendimiento.
    tracesSampleRate: 0,
    // Nada de usuario, cookies, cabeceras, cuerpos, query (?q= es la
    // pregunta), entradas al modelo ni consultas SQL.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
    },
    beforeSend: (evento) => limpiarEvento(evento),
    beforeBreadcrumb: (miga) => limpiarMiga(miga),
  });
}
