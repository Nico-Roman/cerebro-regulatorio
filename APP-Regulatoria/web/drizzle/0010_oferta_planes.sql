-- Snapshot y journal generados con `drizzle-kit generate`; el SQL, con
-- IF NOT EXISTS igual que 0005–0009.
--
-- Los planes se ofrecen UNA vez, al terminar el registro (modal en /normativa).
-- Después no se vuelve a vender nada salvo que la persona llegue al límite de
-- su plan (ahí aparece otro modal). `planes_ofrecidos_at` es la marca de que
-- esa única oferta ya se mostró.
--
-- Quienes ya estaban registrados antes de esto quedan marcados como ofrecidos:
-- para ellos el registro ya pasó, y ofrecerles planes ahora sería venderles
-- después de registrarse. Si alguna vez se quiere anunciar los planes a todos,
-- basta con `UPDATE perfil SET planes_ofrecidos_at = NULL`.
--
-- Solo agrega una columna que admite nulo y marca filas existentes: se aplica
-- con el servicio arriba.

ALTER TABLE "perfil" ADD COLUMN IF NOT EXISTS "planes_ofrecidos_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "perfil" SET "planes_ofrecidos_at" = now()
WHERE "planes_ofrecidos_at" IS NULL AND "acepta_privacidad_at" IS NOT NULL;
