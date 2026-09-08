import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Las migraciones se versionan en el repo y se aplican al arrancar el
  // contenedor. Nunca `push` en producción: eso compara y altera a ciegas.
  strict: true,
  verbose: true,
});
