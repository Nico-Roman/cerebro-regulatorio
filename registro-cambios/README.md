# Registro de cambios normativos

Bitácora **histórica** de cómo se ha movido el listado oficial de normativa
ANAMED del ISP, y del estado del corpus que usa el Cerebro Regulatorio.

## Por qué existe

`vigilancia-isp/snapshots/last-diff.json` se **sobrescribe en cada corrida** del
pipeline diario, y `vigilancia-isp/historial.json` solo guarda contadores
(«3 modificadas»), no el contenido. Es decir: hasta ahora no quedaba rastro de
*qué* cambió. Esta carpeta conserva ese detalle, campo por campo, para siempre.

## ⚠️ Esto NO es fuente normativa

Nada de lo que hay acá entra al corpus del Cerebro Regulatorio, **por diseño**:

- `build_corpus.py` indexa exclusivamente `ANAMED_Normativa/*/*.pdf`. Esta
  carpeta está fuera de `ANAMED_Normativa/` y no contiene PDFs.
- Los archivos son `.md` y `.jsonl` — formatos que el pipeline de ingesta ni
  siquiera mira.
- El texto de acá es **descripción de metadatos** (títulos, fechas, enlaces del
  listado), nunca texto legal citable.

Si alguna vez necesitas citar una norma, la fuente sigue siendo el PDF en
`ANAMED_Normativa/` y la respuesta sale de `cerebro/respuesta.py` (y de su copia en la web, `web/lib/search.ts`). **Nunca de acá.**
Este registro sirve para responder «¿qué cambió y cuándo?», no «¿qué dice la
norma?».

## Archivos

| Archivo | Qué es |
|---|---|
| `cambios.jsonl` | Append-only. Una línea JSON por cambio detectado y por revisión ejecutada. Nunca se reescribe ni se ordena. |
| `pendientes.md` | Normas del listado oficial que **no** están disponibles en disco, con el motivo y desde cuándo. Se regenera cada revisión. |
| `informes/YYYY-Www.md` | Informe legible de cada revisión semanal. |
| `estado/snapshot-referencia.json` | Copia propia del último listado revisado. Es la base del diff semanal, independiente de lo que haga el pipeline diario. |
| `estado/reintentos.json` | Resultado del reintento de descarga de faltantes (lo escribe el pipeline diario, que sí tiene red). |
| `revisar-semanal.js` | El script de la revisión. No requiere red. |

## Uso

```bash
node revisar-semanal.js            # revisa, registra y escribe el informe
node revisar-semanal.js --dry-run  # muestra qué haría, sin escribir nada
```

Corre automáticamente los lunes 08:00 (hora de Chile) como tarea programada.
