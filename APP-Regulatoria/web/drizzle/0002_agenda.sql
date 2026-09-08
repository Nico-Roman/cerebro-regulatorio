-- Escrita a mano, igual que 0001 (ver el encabezado de esa migración).

CREATE TABLE "agenda_config" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"duracion_min" integer DEFAULT 30 NOT NULL,
	"buffer_min" integer DEFAULT 15 NOT NULL,
	"dia_inicio" integer DEFAULT 1 NOT NULL,
	"dia_fin" integer DEFAULT 5 NOT NULL,
	"hora_inicio" text DEFAULT '19:00' NOT NULL,
	"hora_fin" text DEFAULT '22:00' NOT NULL,
	"zona" text DEFAULT 'America/Santiago' NOT NULL,
	"antelacion_horas" integer DEFAULT 24 NOT NULL,
	"horizonte_dias" integer DEFAULT 21 NOT NULL,
	"calendarios" jsonb DEFAULT '["primary"]'::jsonb NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "agenda_config" ("id") VALUES ('default') ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"empresa" text,
	"motivo" text,
	"inicio" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"google_event_id" text,
	"meet_url" text,
	"estado" text DEFAULT 'confirmada' NOT NULL,
	"token_gestion" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservas_token_gestion_unique" UNIQUE("token_gestion")
);
--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "reservas_inicio_idx" ON "reservas" USING btree ("inicio");
--> statement-breakpoint
CREATE INDEX "reservas_estado_idx" ON "reservas" USING btree ("estado");
