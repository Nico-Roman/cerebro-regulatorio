// Arranque de la observabilidad del servidor (Next 16: instrumentation.ts).
// Sentry solo se carga si hay SENTRY_DSN; sin la variable esto no hace nada.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// Errores de render y de rutas. Sin Sentry inicializado es un no-op.
export const onRequestError = Sentry.captureRequestError;
