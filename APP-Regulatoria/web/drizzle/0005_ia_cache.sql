-- Escrita a mano, igual que 0001–0004.
--
-- Caché de redacciones compartida entre usuarios. `clave_ia` es un sha256 de la
-- pregunta normalizada, los pasajes exactos, el modelo y la versión del prompt
-- (lib/ia/redactar.ts → claveCache). Si el corpus cambia lo recuperado, la clave
-- cambia sola y no hay que invalidar nada.
--
-- `fuentes_llm` guarda las citas ya resueltas contra los pasajes del momento en
-- que se redactó: al reutilizar la respuesta después, los enlaces siguen
-- apuntando a lo que el modelo leyó.
--
-- Solo agrega columnas que admiten nulo y un índice: no toca filas existentes.

ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "clave_ia" text;
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "fuentes_llm" jsonb;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consultas_clave_ia_idx" ON "consultas" USING btree ("clave_ia") WHERE "consultas"."respuesta_llm" IS NOT NULL;
