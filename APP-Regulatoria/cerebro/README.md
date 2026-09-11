# Cerebro Regulatorio — núcleo de recuperación

Implementación funcional del **núcleo del PRD** ([../PRD-cerebro-regulatorio.md](../PRD-cerebro-regulatorio.md)):
un motor que, dada una consulta en lenguaje natural, recupera los **pasajes
normativos exactos con cita trazable** sobre el corpus regulatorio chileno (ISP/ANAMED).

**Desde 2026-09-11 la respuesta que ve el usuario no usa IA.** `respuesta.py`
(y su copia exacta en TypeScript, `web/lib/search.ts`) elige el pasaje que
responde, extrae la frase clave y dice con una de tres palabras cuánto se puede
confiar: *encontrado*, *parcial* o *ausente*. El lector es un químico
farmacéutico que no necesariamente es experto regulatorio: por eso se muestra
una frase textual con su cita corta ("DS 466 · art. 8"), no una lista de seis
pasajes con puntajes. La redacción con IA queda como capa opcional y apagada.

> **Las cifras de este README las genera el pipeline.** Si no coinciden con
> `corpus/audit-report.md`, manda el audit-report: es el que se regenera en cada
> build. Última verificación manual: 2026-08-26.

## Estado actual

| | |
|---|---|
| PDFs en `ANAMED_Normativa/` | 164 |
| Documentos indexados (tras colapsar copias) | **133** (121 del ISP + 12 del Código Sanitario) |
| Copias duplicadas colapsadas | 43 |
| Pasajes (chunks) | **2.823** (2.584 del ISP + 239 de la ley) |
| Texto nativo / OCR / sin texto / XML | 60 / 59 / 2 / 239 |
| Con vigencia verificada contra el listado oficial | **120 de 121** |
| Normas únicas en el listado oficial del ISP | 124 (snapshot 2026-09-09) |
| Código Sanitario (DFL 725) | 222 artículos · texto refundido 2025-09-29 |
| **recall@5** (24 preguntas doradas) | **100%** |
| **Abstención** (5 consultas fuera del corpus) | **100%** |
| Preguntas reales de QF, respuesta visible en las 3 primeras (dev / holdout) | **19/22 · 16/17** (antes 8/22 · 7/17) |
| Respuestas en verde que no contenían la respuesta (dev / holdout) | **0 · 0** (antes 8 · 9) |

El único documento sin match es `otros/CODIGO-ETICA-ISP`, que **no es** una norma
del listado ANAMED: su metadata está curada a mano en `overrides.json` y queda
marcado `⚠️ vigencia no verificada` a propósito.

## Dos fuentes, dos caminos

El corpus ANAMED es la capa **reglamentaria**: resoluciones, decretos y normas
técnicas del ISP, que entran por PDF porque el ISP no publica otra cosa. Debajo
de todas ellas está la **ley** que las habilita, y desde el 2026-09-09 el
Código Sanitario (DFL 725) entra por su propia puerta —`codigo_sanitario.py`—
desde el XML refundido de la BCN. Eso da vigencia certificada en la fuente,
troceado por artículo sin heurística y enlace profundo al artículo citado. El
detalle de por qué, en el encabezado de ese archivo.

La ley se vigila aparte y con más precisión que el listado del ISP: el XML trae
`fechaVersion` **por artículo**, así que el pipeline detecta exactamente qué
artículos se movieron, no solo que el archivo cambió. El rastro queda en
`registro-cambios/` (bitácora `cambios.jsonl` + informe legible).

```bash
python codigo_sanitario.py --resumen   # estructura y conteos
python codigo_sanitario.py --vigilar   # baja, compara y registra los cambios
```

## Arquitectura

```
ANAMED_Normativa/ (163 PDFs + sidecars OCR)        vigilancia-isp/ (reg-watch)
Obsidian vault (catálogo curado, complementario)   snapshot: 170 filas → 124 normas
        │                                                    │
        │                                    norma_registry.py│ empareja PDF ↔ norma
        │                                    (URL → tipo+nº → overrides.json)
        └──────────────►  build_corpus.py  ◄─────────────────┘
                                │  extrae texto (PyMuPDF → fallback OCR)
                                │  trocea por artículo / párrafo / oración
                                │  marca sección (preámbulo vs. resolutiva)
                                │  colapsa copias de la misma norma
                                │  modificaciones.py → grafo por disposición
                                │  señala cifras dudosas de OCR
                                ▼
                    corpus/corpus.jsonl        (2.578 pasajes con cita)
                    corpus/metadata.json       (120 documentos)
                    corpus/modificaciones.json (grafo norma → modifica → norma)
                    corpus/indice.pkl          (índice invertido BM25)
                    corpus/audit-report.md
                                │
                                ▼
              respuesta.py  ◄── vocabulario.json ──►  web/lib/search.ts
              (Python, CLI)     (palabras del QF →      (TypeScript, la web
                                 palabras de la norma)   en Railway)
                                │  mismo algoritmo, verificado por paridad
                                │  1. traduce la pregunta al vocabulario legal
                                │  2. BM25 + peso por concepto + tipo de pregunta
                                │  3. frase clave del pasaje (no el pasaje entero)
                                │  4. estado: encontrado · parcial · ausente
                                │  5. avisos: plazos distintos, la ley prima, vigencia
                                ▼
          "DS 466 · art. 8" + frase textual + fuente oficial  ·  o "no está en el corpus"
```

### Decisiones que vale la pena conocer

**La fuente de verdad de los metadatos es el listado oficial del ISP**, no el
nombre del archivo. `norma_registry.py` empareja cada PDF con su norma por el
*basename de la URL de descarga* (resuelve 162 de 163), con el parseo del nombre
de archivo como desempate. Antes se parseaba el nombre y eso fallaba en toda la
carpeta `otros/`, arrastrando cuatro síntomas en cadena: sin tipo/número → sin
match de vigencia → título = nombre de archivo → el boost de título penalizaba
al documento en el ranking.

**La vigencia es por disposición, no por norma.** Que la norma figure vigente en
el listado del ISP no significa que el punto que estás citando siga vigente:
la Res. Ex. 1287 está vigente, pero su número 2 fue reemplazado íntegro por la
Res. Ex. 1651. `modificaciones.py` extrae ese grafo del propio texto legal
(encabezados, parte resolutiva y notas de BCN) y marca el pasaje afectado con
`⛔ disposición modificada`.

**El texto legal no se reescribe nunca.** El OCR corrompe justamente los números
(hay pasajes que dicen «artículos 949 y 1029 del Código Sanitario» donde el
original dice 94 y 102). La respuesta no es corregirlos —una cifra "arreglada" en
silencio es peor que una marcada—, sino señalarlos: `alertas_ocr` por pasaje,
`⚠ texto OCR` en la cita, y `--sin-ocr` para excluirlos cuando la pregunta pide
una cifra exacta.

**Una copia por norma.** El sitio del ISP lista la misma norma bajo varias
categorías, así que el mismo PDF estaba en varias carpetas y su texto entraba
varias veces al índice: casi la mitad del corpus era texto repetido, lo que además
devaluaba el IDF de los términos propios de esas normas. Ahora se indexa una
copia y se conservan todas sus categorías (`categorias[]`), lo que además hace
de `--categoria` una partición real.

## Anti-alucinación: de promesa a mecanismo

La auditoría del 2026-09-11 midió lo que ve el usuario, no lo que recupera el
índice, y encontró el problema real: el motor anterior (`query.py`) ponía en
verde respuestas que no contenían el dato pedido (8 de 13 verdes falsos en las
preguntas de desarrollo). El pasaje correcto solía estar entre los seis, pero
no arriba, y el usuario tenía que leerlos todos para descubrirlo.

`respuesta.py` reemplaza esa señal por reglas que un QF puede auditar:

| Regla | Por qué |
|---|---|
| **Tipo de pregunta** (plazo, monto, temperatura, definición, quién, requisitos…) | "¿En qué plazo…?" solo queda *encontrado* si la frase trae un plazo ("72 horas"). Sin el dato, a lo sumo *parcial*. |
| **Núcleo de la pregunta** | El pasaje principal debe contener los conceptos centrales (el 90% del peso), no palabras de relleno. |
| **Traducción de vocabulario** (`vocabulario.json`) | El QF dice "grave", la norma dice "seria"; "vender por internet" es "expendio electrónico". Las expansiones pesan la mitad que la palabra original. |
| **Definiciones por estructura** | "¿Qué es una droguería?" busca la forma "Droguería: …" o "se entiende por droguería", aunque el pasaje tenga BM25 bajo. |
| **Fuera de alcance explícito** | Dispositivos médicos, rotulado nutricional, SAG, impuestos, FDA/EMA: *ausente* sin buscar. |
| **Avisos** | Si dos normas dan plazos distintos para lo mismo, se dice. Si la ley y un reglamento responden, se recuerda que la ley prima. |

*Ausente* nunca muestra un pasaje como respuesta: los textos cercanos quedan
plegados y rotulados como tales.

## Compuerta de calidad

El pipeline diario corre **dos** evaluaciones y no publica si alguna reprueba
(`actualizar-diario.js`, paso 6):

1. `eval_retrieval.py` — recall@5 ≥ 90% contra `preguntas-doradas.json` y 100%
   de abstención contra `preguntas-fuera-corpus.json`.
2. `eval_respuestas.py` — contra `preguntas-reales.json` (preguntas de QF con la
   evidencia que debe aparecer), separadas en **dev** (para ajustar) y
   **holdout** (para medir):

   | | dev | holdout |
   |---|---|---|
   | Respuesta visible en las 3 primeras | ≥ 75% | ≥ 75% |
   | Verdes falsos | 0 | ≤ 1 |
   | Abstención en preguntas fuera de alcance | 100% | ≥ 66% |
   | Pregunta sin texto en el corpus marcada en verde | 0 | 0 |

   Además exige **paridad**: la web (TypeScript) y `respuesta.py` deben dar el
   mismo estado, la misma cita y la misma frase en todas las preguntas, y
   `web/data/vocabulario.json` debe ser idéntico a `vocabulario.json`. Si alguien
   ajusta un motor y no el otro, la compuerta reprueba.

Nota honesta sobre el holdout: se revisó una vez durante el ajuste. Las
correcciones que siguieron fueron estructurales (cómo se parte un artículo,
cómo se reconoce una definición), no palabras agregadas para esas preguntas.
Para una medición limpia hay que sumar preguntas nuevas de un QF que no se hayan
visto. Lo que sigue fallando: `h16` ("contrato de trabajo") queda *parcial* en
vez de *ausente*.

## Uso

```bash
# 1) (Re)construir el corpus desde los PDFs — cuando entren normas nuevas
PYTHONIOENCODING=utf-8 python build_corpus.py

# 2) Preguntar como lo haría la web (sin IA)
python respuesta.py "¿En qué plazo se notifica una reacción adversa seria?"
python respuesta.py "¿Qué es una droguería?" --json

# 3) Compuertas. exit 1 si reprueban.
python eval_retrieval.py --k 5
python eval_respuestas.py            # incluye la paridad con la web (requiere Node 22+)
python eval_respuestas.py --sin-paridad

# Si cambias vocabulario.json, cópialo a la web:
cp vocabulario.json ../web/data/vocabulario.json
```

Los scripts anteriores (`query.py`, `preguntar.py`, `calibrar_confianza.py`)
siguen en el repo como referencia, pero la web ya no los usa.

Categorías: `cosmeticos`, `ensayos_clinicos`,
`establecimientos_autorizacion_y_fiscalizacion`, `farmacovigilancia`,
`importacion_y_exportacion_control_y_vigilancia`, `laboratorio_nacional_de_control`,
`medicamentos`, `codigo_sanitario`, `otros`.

## Limitaciones conocidas / mejoras siguientes

- **57 de 120 documentos entran por OCR**, y uno (`NT-128-Medicamentos-Herbarios`)
  no tiene texto extraíble ni sidecar OCR. Las alertas señalan las cifras
  dudosas, pero no las arreglan: el audit-report lista los documentos con más
  alertas, que son los candidatos a re-OCR. Es la deuda técnica más cara del corpus.
- **El grafo de modificaciones es de alta precisión y cobertura parcial.** Marca
  la disposición concreta solo cuando el texto la ata explícitamente a la norma de
  destino ("en el sentido de reemplazar el actual número dos de su parte
  resolutiva"). Cuando solo consta que la norma fue modificada, se advierte a
  nivel de norma. Preferir un aviso genérico a un ⛔ equivocado es deliberado.
- **Normas del listado sin texto indexado**: el detalle vivo está en
  `registro-cambios/pendientes.md`, que ahora reconoce como cubiertas las normas
  que el ISP enlaza a LeyChile y que el corpus ya trae por otra vía.
- El detector de artículos puede tomar como encabezado una cita a "artículo N de
  la Constitución" en el preámbulo (afecta la etiqueta, no el texto citado).
- **Lo que NO conviene hacer todavía:** embeddings y re-ranking semántico. Los
  errores que quedan vienen de metadatos y de OCR, no de que BM25 entienda mal el
  lenguaje; sumar semántica encima produciría respuestas equivocadas más
  convincentes. El siguiente salto de verdad es re-OCR y ampliar los dos sets de
  evaluación con un QF.

## Archivos

| Archivo | Qué es |
|---|---|
| `build_corpus.py` | Pipeline de ingesta: PDFs+OCR+listado oficial → corpus indexado |
| `norma_registry.py` | Empareja cada PDF con su norma del listado oficial del ISP |
| `modificaciones.py` | Extrae el grafo de modificaciones a nivel de disposición |
| `indice.py` | Índice invertido BM25 persistente + tokenización y stemming |
| `respuesta.py` | **Motor de respuesta sin IA** (estado, frase clave, cita corta, avisos) |
| `vocabulario.json` | Palabras del QF → palabras de la norma; temas fuera de alcance |
| `../web/lib/search.ts` | El mismo motor en TypeScript, el que usa la web |
| `eval_respuestas.py` | Compuerta sobre lo que ve el usuario + paridad Python/TypeScript |
| `preguntas-reales.json` | Preguntas de QF (dev + holdout) con la evidencia esperada |
| `eval_retrieval.py` | Compuerta: recall@k + abstención (exit 1 si reprueba) |
| `actualizar-diario.js` | Pipeline diario: scrape → descarga → build → compuertas → publicación |
| `query.py` · `preguntar.py` · `calibrar_confianza.py` | Motor anterior (legado, la web ya no lo usa) |
| `preguntas-doradas.json` | Set de evaluación: debe recuperar la fuente correcta |
| `preguntas-fuera-corpus.json` | Contra-set: debe declarar ausencia |
| `overrides.json` | Metadata curada a mano para documentos fuera del listado |
| `corpus/corpus.jsonl` | Pasajes indexados (generado) |
| `corpus/metadata.json` | Metadatos por documento con vigencia (generado) |
| `corpus/modificaciones.json` | Grafo de modificaciones (generado) |
| `corpus/indice.pkl` | Índice invertido serializado (generado) |
| `corpus/audit-report.md` | Auditoría de corpus (generado) |
