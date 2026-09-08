-- Escrita a mano (no por drizzle-kit): la sesión que la creó no tenía red para
-- instalar drizzle-kit ni base a la que introspectar. El aplicador
-- (scripts/migrate.mjs) solo lee los .sql en orden, así que esto basta; si más
-- adelante vuelves a usar `drizzle-kit generate`, regenera los snapshots de
-- drizzle/meta primero.

CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"consulta_id" text NOT NULL,
	"user_id" text NOT NULL,
	"util" boolean NOT NULL,
	"comentario" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_consulta_id_consultas_id_fk" FOREIGN KEY ("consulta_id") REFERENCES "public"."consultas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_consulta_idx" ON "feedback" USING btree ("consulta_id");
--> statement-breakpoint
CREATE INDEX "feedback_created_idx" ON "feedback" USING btree ("created_at");
