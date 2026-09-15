-- Snapshot y journal generados con `drizzle-kit generate`; el SQL, reescrito a
-- mano con IF NOT EXISTS igual que 0001–0005.
--
-- Guardas de la capa de IA. Señales de calidad del borrador (abstuvo,
-- sin_citas, citas_invalidas, datos_no_verificados, caso_no_cubierto) para que
-- una degradación del modelo en producción se vea en la base antes de que
-- alguien reclame, y `bloqueado`: el motivo por el que la compuerta de
-- propósito (lib/ia/proposito.ts) no dejó llegar la consulta al modelo.
--
-- Solo agrega columnas que admiten nulo y un índice parcial: no toca filas
-- existentes y se puede aplicar con el servicio arriba.

ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "abstuvo" boolean;
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "sin_citas" boolean;
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "citas_invalidas" boolean;
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "datos_no_verificados" text;
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "caso_no_cubierto" text;
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "bloqueado" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consultas_bloqueado_idx" ON "consultas" USING btree ("bloqueado") WHERE "consultas"."bloqueado" IS NOT NULL;
