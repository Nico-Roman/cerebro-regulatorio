-- Registro corto: nombre y apellido declarados.
--
-- El formulario de registro se acortó a nombre, apellido, correo y teléfono
-- (empresa opcional). El correo ya vive en "user"; el apellido no vivía en
-- ninguna parte, porque Better Auth guarda un solo campo `name` con lo que
-- entregue el proveedor.
--
-- `cargo` y `tipo_perfil` NO se borran: guardan lo que declararon los que se
-- registraron con el formulario largo y el panel los sigue leyendo. Dejan de
-- pedirse, nada más.
--
-- Backfill del apellido desde `user.name`: primer token = nombre, resto =
-- apellido. Solo toca filas de perfil que ya existen y que todavía no tienen
-- nombre declarado, así que es idempotente y no pisa nada escrito a mano.
--
-- Solo agrega columnas que admiten nulo: no bloquea la tabla ni requiere bajar
-- el servicio.

ALTER TABLE "perfil" ADD COLUMN IF NOT EXISTS "nombre" text;
--> statement-breakpoint
ALTER TABLE "perfil" ADD COLUMN IF NOT EXISTS "apellido" text;
--> statement-breakpoint
UPDATE "perfil" p
SET
  "nombre" = NULLIF(split_part(TRIM(u."name"), ' ', 1), ''),
  "apellido" = NULLIF(
    TRIM(SUBSTRING(TRIM(u."name") FROM POSITION(' ' IN TRIM(u."name")) + 1)),
    TRIM(u."name")
  )
FROM "user" u
WHERE u."id" = p."user_id" AND p."nombre" IS NULL;
