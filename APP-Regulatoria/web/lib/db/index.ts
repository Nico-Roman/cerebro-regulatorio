// Conexión única a Postgres. En Railway la app corre como proceso persistente,
// así que el pool vive mientras viva el contenedor; en desarrollo se guarda en
// globalThis para que el hot reload no abra un pool nuevo en cada recarga.

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __regulamedPool: Pool | undefined;
}

/**
 * Postgres local y la red privada de Railway hablan sin TLS; un host público sí
 * lo exige. Forzar SSL siempre rompe el desarrollo local ("The server does not
 * support SSL connections") y no forzarlo nunca deja la conexión en claro, así
 * que se decide por la URL y se respeta un sslmode explícito si viene.
 */
function sslDeUrl(url: string): false | { rejectUnauthorized: boolean } {
  if (/sslmode=disable/.test(url)) return false;
  if (/sslmode=(require|verify-ca|verify-full)/.test(url)) {
    return { rejectUnauthorized: false };
  }
  return /railway\.internal|@localhost|@127\.0\.0\.1|@\[::1\]/.test(url)
    ? false
    : { rejectUnauthorized: false };
}

function crearPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // `next build` evalúa este módulo al recolectar los datos de las páginas
    // que dependen de la sesión (/ingresar, /perfil), y en el build no hay
    // base de datos ni debe haberla: la URL de Postgres es un secreto de
    // runtime, no un argumento de compilación. Lanzar acá rompía el build
    // entero ("Failed to collect page data for /ingresar").
    //
    // No se pierde la falla temprana: scripts/migrate.mjs aborta el arranque
    // del contenedor si DATABASE_URL no está, así que un despliegue sin base
    // no llega a servir tráfico. Este pool imposible solo existe para que el
    // build pueda importar el módulo; cualquier consulta contra él falla.
    console.warn(
      "[db] DATABASE_URL no está configurada: solo válido durante el build."
    );
    return new Pool({
      connectionString: "postgres://sin-configurar@127.0.0.1:1/sin-configurar",
      max: 1,
    });
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    ssl: sslDeUrl(connectionString),
  });
}

export const pool =
  global.__regulamedPool ?? (global.__regulamedPool = crearPool());

export const db = drizzle(pool, { schema });
export { schema };
