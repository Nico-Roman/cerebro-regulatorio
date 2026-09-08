// Aplica las migraciones de drizzle/ al arrancar el contenedor.
//
// Usa solo `pg` a propósito: la imagen de producción lleva el node_modules que
// el trazado de Next considera necesario, y drizzle-kit (que es herramienta de
// desarrollo) no está ahí. Leer los .sql y registrarlos en una tabla propia es
// suficiente y no agrega dependencias al runtime.

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const DIR = path.join(process.cwd(), "drizzle");

/**
 * Postgres local y la red privada de Railway hablan sin TLS; un host público
 * sí lo exige. Forzar SSL siempre rompe el desarrollo local ("The server does
 * not support SSL connections") y no forzarlo nunca expone la conexión, así
 * que se decide por la URL y se respeta un sslmode explícito si viene.
 */
function sslDeUrl(url) {
  if (/sslmode=disable/.test(url)) return false;
  if (/sslmode=(require|verify-ca|verify-full)/.test(url)) {
    return { rejectUnauthorized: false };
  }
  return /railway\.internal|@localhost|@127\.0\.0\.1|@\[::1\]/.test(url)
    ? false
    : { rejectUnauthorized: false };
}


async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[migrate] DATABASE_URL no está configurada. Abortando.");
    process.exit(1);
  }
  if (!fs.existsSync(DIR)) {
    console.log("[migrate] No hay carpeta drizzle/, nada que aplicar.");
    return;
  }

  const pool = new Pool({ connectionString, ssl: sslDeUrl(connectionString) });

  const cliente = await pool.connect();
  try {
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS __migraciones (
        archivo text PRIMARY KEY,
        aplicada_en timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await cliente.query("SELECT archivo FROM __migraciones");
    const aplicadas = new Set(rows.map((r) => r.archivo));

    const pendientes = fs
      .readdirSync(DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .filter((f) => !aplicadas.has(f));

    if (!pendientes.length) {
      console.log("[migrate] Base de datos al día.");
      return;
    }

    for (const archivo of pendientes) {
      const sql = fs.readFileSync(path.join(DIR, archivo), "utf-8");
      // Cada migración va en su propia transacción: si una falla, no deja la
      // base a medio migrar ni marca el archivo como aplicado.
      await cliente.query("BEGIN");
      try {
        for (const sentencia of sql.split("--> statement-breakpoint")) {
          const limpia = sentencia.trim();
          if (limpia) await cliente.query(limpia);
        }
        await cliente.query("INSERT INTO __migraciones (archivo) VALUES ($1)", [archivo]);
        await cliente.query("COMMIT");
        console.log(`[migrate] Aplicada ${archivo}`);
      } catch (e) {
        await cliente.query("ROLLBACK");
        console.error(`[migrate] Falló ${archivo}:`, e.message);
        throw e;
      }
    }
  } finally {
    cliente.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[migrate] Error fatal:", e.message);
  process.exit(1);
});
