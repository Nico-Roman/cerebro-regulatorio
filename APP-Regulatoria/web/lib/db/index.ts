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
    throw new Error(
      "DATABASE_URL no está configurada: la app no puede hablar con Postgres."
    );
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
