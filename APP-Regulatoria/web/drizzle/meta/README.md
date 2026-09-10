# Estado de `drizzle/meta/`

Estos archivos son **solo** la contabilidad de `drizzle-kit`. Quien aplica las
migraciones en producción es `scripts/migrate.mjs`, que lee los `.sql` de
`drizzle/` en orden y lleva su propia tabla de aplicadas. Nada de lo que hay
aquí decide qué corre contra la base.

## Por qué el journal estuvo incompleto

Las migraciones `0001`–`0003` se escribieron a mano: la sesión que las creó no
tenía red para instalar `drizzle-kit` ni base a la que introspectar. El journal
quedó conociendo solo `0000`. Como `drizzle-kit generate` diffea el esquema
contra el **último snapshot del journal**, habría creído que `feedback`,
`agenda_config` y `reservas` no existían y habría propuesto crearlas de nuevo
—contra tablas que en producción ya tienen datos.

## Cómo quedó (2026-09-09)

- El journal declara las cuatro migraciones, `0000`–`0003`.
- `0003_snapshot.json` es el estado **real** del esquema de hoy. Se obtuvo
  corriendo `drizzle-kit generate` contra un `out/` vacío, lo que produce un
  snapshot completo de `lib/db/schema.ts`, y encadenando su `prevId` al `id` de
  `0000_snapshot.json`.
- Comprobado: `npx drizzle-kit generate` responde
  *"No schema changes, nothing to migrate"*. Es la prueba de que el snapshot
  coincide con el esquema y de que ya no propone recrear nada.

## Por qué no hay `0001_snapshot.json` ni `0002_snapshot.json`

`generate` solo lee el último snapshot del journal, y no exige los intermedios
—se verificó corriéndolo. Inventarlos habría significado escribir a mano dos
estados históricos que nadie midió: historia falsa a cambio de nada. Si algún
día hace falta la cadena completa (por ejemplo para `drizzle-kit drop`), hay que
reconstruirlos generando cada paso desde su esquema de época, no copiando.

## Regla para el futuro

Si vuelves a escribir una migración a mano, agrega en el mismo commit su entrada
en `_journal.json` y su snapshot. Si no, esto se vuelve a romper igual.
