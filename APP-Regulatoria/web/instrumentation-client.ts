// Sentry en el navegador. Usa NEXT_PUBLIC_SENTRY_DSN (se fija en el build); sin
// ella no se inicializa. Mismas reglas que el servidor: nada de preguntas ni
// cuerpos de solicitudes (lib/sentry-limpiar.ts).
import * as Sentry from "@sentry/nextjs";
import { limpiarEvento, limpiarMiga } from "@/lib/sentry-limpiar";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
