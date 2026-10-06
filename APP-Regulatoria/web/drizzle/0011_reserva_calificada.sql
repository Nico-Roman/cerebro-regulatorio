-- Snapshot y journal generados con `drizzle-kit generate`; el SQL, con
-- IF NOT EXISTS igual que 0005–0010.
--
-- Evaluación calificada (decisión del 24-09-2026): la agenda pide qué producto
-- es y en qué etapa está (lib/calificacion.ts). Aditiva: dos columnas que
-- admiten nulo, así que las reservas anteriores quedan intactas. Se aplica con
-- el servicio arriba.

ALTER TABLE "reservas" ADD COLUMN IF NOT EXISTS "producto" text;--> statement-breakpoint
ALTER TABLE "reservas" ADD COLUMN IF NOT EXISTS "etapa" text;
