-- Escrita a mano, igual que 0001–0003.
--
-- Dos reservas confirmadas no pueden compartir horario. La revalidación contra
-- Google y contra la base deja una ventana: si dos personas reservan el mismo
-- hueco a la vez, las dos pasan. El índice parcial cierra esa ventana; la
-- segunda inserción falla con 23505 y la ruta la convierte en "hueco_tomado".
--
-- Si ya existieran duplicados confirmados, esta migración fallaría y el
-- contenedor no arrancaría (el despliegue anterior sigue sirviendo). Al
-- 11-09-2026 la agenda no estaba encendida en producción, así que no hay filas.

CREATE UNIQUE INDEX IF NOT EXISTS "reservas_inicio_confirmada_idx" ON "reservas" USING btree ("inicio") WHERE "reservas"."estado" = 'confirmada';
