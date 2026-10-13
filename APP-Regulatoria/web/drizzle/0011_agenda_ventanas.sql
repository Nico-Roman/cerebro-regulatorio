-- Snapshot y journal generados con `drizzle-kit generate`; el SQL, con
-- IF NOT EXISTS igual que 0005–0010.
--
-- La agenda pasa de un rango único (lunes a viernes, una sola franja) a una
-- ventana por día, para atender cuando el cliente puede: lunes y miércoles
-- desde las 18:00, viernes desde las 16:00 y sábado y domingo en la mañana.
-- Con reuniones de 30 minutos, los inicios van cada 15 (`paso_min`).
--
-- El UPDATE carga ese horario en la fila 'default' una sola vez; después se
-- cambia desde /admin/agenda. Las columnas del rango viejo quedan como están:
-- con `ventanas` llena nadie las lee, y botarlas no aporta nada.
--
-- Solo agrega columnas con default o que admiten nulo y actualiza una fila:
-- se aplica con el servicio arriba.

ALTER TABLE "agenda_config" ADD COLUMN IF NOT EXISTS "ventanas" jsonb;
--> statement-breakpoint
ALTER TABLE "agenda_config" ADD COLUMN IF NOT EXISTS "paso_min" integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
UPDATE "agenda_config" SET
  "ventanas" = '[
    {"dia": 1, "inicio": "18:00", "fin": "21:00"},
    {"dia": 3, "inicio": "18:00", "fin": "21:00"},
    {"dia": 5, "inicio": "16:00", "fin": "20:00"},
    {"dia": 6, "inicio": "09:00", "fin": "13:00"},
    {"dia": 7, "inicio": "09:00", "fin": "13:00"}
  ]'::jsonb,
  "paso_min" = 15,
  "updated_at" = now()
WHERE "id" = 'default';
