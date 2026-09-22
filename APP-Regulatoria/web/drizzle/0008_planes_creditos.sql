-- Snapshot y journal generados con `drizzle-kit generate`; el SQL, con
-- IF NOT EXISTS en tablas e índices igual que 0005–0007.
--
-- Planes y créditos de la capa de IA (22-09-2026). Reglas en lib/planes.ts.
--
--   suscripciones         un plan pagado vigente (Profesional o Director Técnico).
--                         El plan gratis no tiene fila.
--   suscripcion_miembros  quiénes comparten el cupo (el titular también).
--   movimientos_creditos  libro append-only: compras de pack (+), consumos (−),
--                         reembolsos (+). Saldos y usos son sumas sobre esta tabla.
--
-- Solo crea tablas nuevas: no toca filas existentes y se puede aplicar con el
-- servicio arriba. Las FK se agregan en el mismo archivo que crea las tablas,
-- y migrate.mjs corre cada archivo en una transacción: o queda todo, o nada.

CREATE TABLE IF NOT EXISTS "movimientos_creditos" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"suscripcion_id" text,
	"fuente" text NOT NULL,
	"tipo" text NOT NULL,
	"creditos" integer NOT NULL,
	"consulta_id" text,
	"tokens_entrada" integer,
	"tokens_salida" integer,
	"referencia" text,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suscripcion_miembros" (
	"suscripcion_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suscripcion_miembros_suscripcion_id_user_id_pk" PRIMARY KEY("suscripcion_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suscripciones" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"titular_user_id" text NOT NULL,
	"vigente_desde" timestamp with time zone DEFAULT now() NOT NULL,
	"vence_en" timestamp with time zone NOT NULL,
	"estado" text DEFAULT 'activa' NOT NULL,
	"origen" text,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movimientos_creditos" ADD CONSTRAINT "movimientos_creditos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_creditos" ADD CONSTRAINT "movimientos_creditos_suscripcion_id_suscripciones_id_fk" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_creditos" ADD CONSTRAINT "movimientos_creditos_consulta_id_consultas_id_fk" FOREIGN KEY ("consulta_id") REFERENCES "public"."consultas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripcion_miembros" ADD CONSTRAINT "suscripcion_miembros_suscripcion_id_suscripciones_id_fk" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripcion_miembros" ADD CONSTRAINT "suscripcion_miembros_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_titular_user_id_user_id_fk" FOREIGN KEY ("titular_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "movimientos_user_fuente_idx" ON "movimientos_creditos" USING btree ("user_id","fuente","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "movimientos_suscripcion_idx" ON "movimientos_creditos" USING btree ("suscripcion_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "movimientos_created_idx" ON "movimientos_creditos" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suscripcion_miembros_user_idx" ON "suscripcion_miembros" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suscripciones_titular_idx" ON "suscripciones" USING btree ("titular_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suscripciones_vence_idx" ON "suscripciones" USING btree ("vence_en");