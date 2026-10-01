-- Snapshot y journal generados con `drizzle-kit generate`; el SQL, con
-- IF NOT EXISTS en tablas, columnas e índices igual que 0005–0012.
--
-- Asistente, fase 2 (encargo C): /normativa es un hilo. Una tabla nueva y una
-- columna que admite nulo: no toca filas existentes y se aplica con el servicio
-- arriba. migrate.mjs corre el archivo en una transacción.

CREATE TABLE IF NOT EXISTS "conversaciones" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "conversacion_id" text;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversaciones_user_created_idx" ON "conversaciones" USING btree ("user_id","created_at");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "consultas" ADD CONSTRAINT "consultas_conversacion_id_conversaciones_id_fk" FOREIGN KEY ("conversacion_id") REFERENCES "public"."conversaciones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consultas_conversacion_idx" ON "consultas" USING btree ("conversacion_id","created_at");
