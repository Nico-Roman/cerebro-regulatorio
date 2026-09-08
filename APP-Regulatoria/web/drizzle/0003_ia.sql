-- Escrita a mano, igual que 0001 y 0002.

ALTER TABLE "consultas" ADD COLUMN "respuesta_llm" text;
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN "modelo" text;
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN "tokens_in" integer;
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN "tokens_out" integer;
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN "latencia_ms" integer;
