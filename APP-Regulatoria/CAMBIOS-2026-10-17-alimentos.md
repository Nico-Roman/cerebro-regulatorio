# Cambios del 17-10-2026: alimentos y suplementos entran al corpus

Rama `claude/alimentos-rsa`, construida **encima del PR 2**
(`claude/arreglos-pendientes-plan-l14usy`) porque reutiliza su ingestor
`decretos_bcn.py`. Se mergea después del PR 2. No está desplegada.

## Qué entra

Cuatro normas del Minsal, todas por el XML refundido de la BCN, igual que el
Código Sanitario y el DS 825: troceadas por artículo, con vigencia certificada
por la BCN y vigilancia de cambios por artículo en el pipeline diario.

| Norma | BCN idNorma | Versión | Pasajes |
|---|---|---|---|
| DS 977/1996, Reglamento Sanitario de los Alimentos (RSA) | 71271 | 2026-06-19 | 599 (559 artículos, 3 derogados) |
| Res. Ex. 394/2002, directrices de suplementos (límites de vitaminas y minerales) | 194953 | 2005-01-13 | 3 |
| Res. Ex. 393/2002, vitaminas y minerales en alimentos | 194952 | 2008-11-15 | 5 |
| Res. Ex. 860/2017, aprueba la NT 191 de propiedades saludables | 1105664 | 2018-01-12 | 10 |

Categoría nueva del corpus: `alimentos` («Alimentos y suplementos» en la web).

## Cambios de código

- `decretos_bcn.py`:
  - Lee `fuentes-dispositivos.json` y el nuevo `fuentes-alimentos.json`, cada
    uno con su categoría.
  - Baja a los artículos **anidados** («Doble Articulado»). Sin eso, la NT 191
    no entraba: sus 7 artículos viven dentro del art. 1 de la Res. 860.
  - No inventa «Artículo ?» en las resoluciones que no numeran su artículo.
  - Vacía las imágenes incrustadas del XML. El RSA pesaba 19 MB y el 99% eran
    tablas en base64 que el ingestor no lee; la caché versionada queda en 673 KB.
  - El DS 825 sale igual que antes (31 artículos, 36 pasajes).
- `vocabulario.json` (y su copia en `web/data/`):
  - La regla «rotulado nutricional» lleva `salvo_categoria: alimentos`.
  - Expansiones nuevas: sello → características nutricionales / ALTO EN /
    símbolo octagonal; isotónica → osmolalidad; advertencia → leyenda.
  - Regla nueva fuera de alcance: «los trámites de autorización de alimentos y
    suplementos ante la SEREMI». Los suplementos no tienen registro por
    producto y el corpus no lo dice en ninguna parte: sin la regla, «¿cómo se
    registra un suplemento?» salía en verde con la Res. 394 n° 7, que habla de
    productos antiguos registrados como medicamentos (verde falso en h15).
- Web: etiqueta de la categoría en `lib/search.ts`, y `/cobertura` deja de
  decir «no incluye alimentos» cuando el corpus trae la categoría.

## Evaluación (local)

El corpus de prueba fue el de producción (`web/data/corpus.jsonl` de la rama)
más los pasajes de alimentos. Un build local completo no sirve para comparar:
CI baja los PDF con otros nombres y categorías.

| | Antes | Después |
|---|---|---|
| recall@5 (doradas) | 35/36 | **41/42** (6 nuevas `al-*`, todas OK; la falla es `cs-farmaceutico-direccion`, que ya existía) |
| Abstención (fuera del corpus) | 3/3 | 2/2 (`alimentos-rotulado` pasa a las doradas cuando existe la categoría) |
| Dev: visible@3 · verdes falsos | 19/22 · 0 | **22/25 · 0** (3 nuevas `a0*`, todas visibles) |
| Holdout: visible@3 · verdes falsos · abstención | 16/17 · 0 · 2/3 | **16/17 · 0 · 2/3** (sin cambios) |
| Paridad Python ↔ TypeScript | — | idénticos en 51 preguntas |
| Pruebas web | — | 60/60 |

Nota honesta: h15 (holdout) se miró al diagnosticar el verde falso. El arreglo
es una regla de alcance, no una palabra agregada para esa pregunta.

## Pendientes

- **Ley 20.606:** no se encontró su idNorma en la BCN. Su contenido operativo
  (sellos y límites) está en el art. 120 bis del RSA, que sí entra.
- **Tablas del RSA:** vienen como imagen en la BCN. Los límites de la Tabla
  N° 1 del art. 120 bis (sodio, azúcares, calorías) no son buscables. Habría
  que transcribirlos a mano en un pasaje curado.
- Correr «Corpus diario» sobre la rama antes del merge, que es la compuerta
  real con el corpus de CI.
