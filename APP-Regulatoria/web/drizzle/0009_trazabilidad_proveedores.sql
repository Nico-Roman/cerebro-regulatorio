-- Snapshot y journal generados con `drizzle-kit generate`; el SQL, con
-- IF NOT EXISTS igual que 0005–0008.
--
-- Proveedor de IA intercambiable y trazabilidad para márgenes y LTV (22-09-2026).
--
--   modelos_ia   catálogo de modelos; el activo se elige en /admin/planes. La
--                clave de API no se guarda: env_clave es el NOMBRE de la variable.
--   pagos        lo que entró de verdad, una fila por pago (base del LTV).
--   consultas    + proveedor, costo_usd: lo que costó cada redacción con el
--                precio del modelo que la respondió.
--   suscripciones + cancelada_en, motivo_fin: para medir bajas (churn).
--
-- Al final: el modelo de hoy queda en el catálogo (inactivo: mientras no se
-- active nada, mandan las variables LLM_* igual que antes), y las redacciones
-- anteriores reciben su costo calculado con el precio de gpt-oss-120b en Groq.
--
-- Solo agrega tablas, columnas que admiten nulo e índices: se aplica con el
-- servicio arriba.

CREATE TABLE IF NOT EXISTS "modelos_ia" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"proveedor" text NOT NULL,
	"base_url" text NOT NULL,
	"modelo" text NOT NULL,
	"env_clave" text NOT NULL,
	"usd_millon_entrada" real NOT NULL,
	"usd_millon_salida" real NOT NULL,
	"activo" boolean DEFAULT false NOT NULL,
	"notas" text,
	"ultima_prueba" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pagos" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"suscripcion_id" text,
	"concepto" text NOT NULL,
	"detalle" text,
	"monto_clp" integer NOT NULL,
	"meses" integer,
	"medio" text,
	"referencia" text,
	"fecha_pago" timestamp with time zone DEFAULT now() NOT NULL,
	"registrado_por" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "proveedor" text;--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "costo_usd" real;--> statement-breakpoint
ALTER TABLE "suscripciones" ADD COLUMN IF NOT EXISTS "cancelada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "suscripciones" ADD COLUMN IF NOT EXISTS "motivo_fin" text;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_suscripcion_id_suscripciones_id_fk" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "modelos_ia_un_activo_idx" ON "modelos_ia" USING btree ("activo") WHERE "modelos_ia"."activo" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pagos_user_fecha_idx" ON "pagos" USING btree ("user_id","fecha_pago");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pagos_fecha_idx" ON "pagos" USING btree ("fecha_pago");

--> statement-breakpoint
INSERT INTO "modelos_ia" ("id", "nombre", "proveedor", "base_url", "modelo", "env_clave",
  "usd_millon_entrada", "usd_millon_salida", "activo", "notas")
VALUES ('groq-gpt-oss-120b', 'gpt-oss-120b (Groq)', 'groq', 'https://api.groq.com/openai/v1',
  'openai/gpt-oss-120b', 'LLM_API_KEY', 0.15, 0.6, false,
  'Modelo con el que partió RegulaMED (sept. 2026). Precios al 14-09-2026.')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "consultas"
SET "costo_usd" = (COALESCE("tokens_in", 0) * 0.15 + COALESCE("tokens_out", 0) * 0.6) / 1000000.0,
    "proveedor" = COALESCE("proveedor", 'groq')
WHERE "respuesta_llm" IS NOT NULL AND "costo_usd" IS NULL;
