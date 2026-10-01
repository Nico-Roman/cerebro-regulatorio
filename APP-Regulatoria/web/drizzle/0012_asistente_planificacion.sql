-- Snapshot y journal generados con `drizzle-kit generate`; el SQL, con
-- IF NOT EXISTS igual que 0005–0011.
--
-- Asistente, fase 1 (encargo C): las búsquedas que propuso la planificación y
-- cuántas oraciones del borrador imponen algo sin cita. Aditiva: dos columnas
-- que admiten nulo. Se aplica con el servicio arriba.

ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "busquedas_planificadas" jsonb;--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "afirmaciones_sin_cita" integer;
