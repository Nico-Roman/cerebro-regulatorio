# Cerebro Regulatorio — núcleo de recuperación

Implementación funcional del **núcleo del PRD** ([../PRD-cerebro-regulatorio.md](../PRD-cerebro-regulatorio.md)):
un motor que, dada una consulta en lenguaje natural, recupera los **pasajes
normativos exactos con cita trazable** sobre el corpus regulatorio chileno (ISP/ANAMED).

La síntesis de la respuesta la hace **Claude Code como cerebro** sobre la evidencia
recuperada (ver skill `cerebro-regulatorio`). No hay dependencia de API externa ni
de infraestructura: todo corre local con Python.

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
                          query.py  (BM25 + boosts + señal de CONFIANZA)
                                │  → pasajes con cita trazable (--json)
                                ├──────────────► preguntar.py (Ollama local)
                                ├──────────────► web/ (Next.js en Vercel)
                                ▼
                 Claude Code (skill cerebro-regulatorio)
                                │  sintetiza SOLO sobre pasajes,
                                │  o declara ausencia si confianza = baja
                                ▼
                 respuesta citada  ·  o "no encontrado en el corpus"
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

La regla "no inventar" vivía solo en prosa, en el prompt de la skill, mientras la
recuperación servía vecinos temáticos con el mismo aspecto que los aciertos. Una
consulta sobre dispositivos médicos —materia fuera del corpus— devolvía seis
pasajes con puntajes indistinguibles de una consulta perfectamente respondible.

`query.py` ahora calcula y devuelve una **señal de confianza**:

| Campo | Qué mide |
|---|---|
| `cobertura` | fracción del peso IDF de la consulta presente en *algún* pasaje |
| `cobertura_top` | lo mismo exigiendo que esté en *un solo* pasaje — la señal fuerte |
| `conceptos_fuera_del_corpus` | raíces de la consulta que no existen en **ningún** pasaje |
| `margen` | distancia entre el 1er puntaje y la mediana del resto |
| `recomendacion` | `responder` · `responder_con_reservas` · `declarar_ausencia` |

Con `declarar_ausencia`, la skill **debe** responder "No encontré esto en el
corpus" en vez de sintetizar. La comparación se hace sobre raíces (stemming
ligero del español), porque sin eso "seleccionan" no reconoce a "selección" y
preguntas legítimas se declaraban fuera del corpus.

La confianza se mide siempre sobre una ventana fija de 8 pasajes, no sobre el `k`
pedido: si no, la misma pregunta cambia de veredicto por haber pedido 5 en vez de 6.

## Compuerta de calidad

`eval_retrieval.py` mide **dos** cosas, porque un buscador legal falla de dos
maneras distintas, y devuelve **exit code 1** si alguna reprueba:

1. **Recall@k** contra `preguntas-doradas.json` — ¿recupera la fuente correcta
   cuando la respuesta existe? Gate: ≥ 90%.
2. **Abstención** contra `preguntas-fuera-corpus.json` — ¿declara ausencia cuando
   la respuesta *no* existe? Gate: 100%.

Sin la segunda mitad, subir el recall a costa de responder siempre pasaría la
evaluación mientras empeora la herramienta. Además vigila que ninguna pregunta
dorada caiga en `confianza: baja`: un falso positivo de abstención convierte la
señal en ruido que se termina ignorando.

**El pipeline diario corre esta compuerta y no publica si reprueba.** Antes no la
corría: por eso el recall pudo bajar de 100% a 94% y desplegarse sin que nadie se
enterara.

## Uso

```bash
# 1) (Re)construir el corpus desde los PDFs — cuando entren normas nuevas
PYTHONIOENCODING=utf-8 python build_corpus.py

# 2) Consultar (modo humano)
python query.py "plazo para notificar reacciones adversas al ISP" --vigente
python query.py "buenas prácticas de manufactura estériles" --categoria establecimientos_autorizacion_y_fiscalizacion
python query.py "plazo exacto en días para el informe" --sin-ocr

# 3) Consultar (modo cerebro: JSON para que Claude sintetice)
python query.py "requisitos para importar productos farmacéuticos" --json --k 6

# 4) Compuerta de calidad (recall + abstención). exit 1 si reprueba.
python eval_retrieval.py --k 5

# 5) Síntesis con un modelo local en vez de Claude
python preguntar.py "plazo para notificar reacciones adversas" --k 6
```

Flags de `query.py`: `--k N`, `--vigente`, `--categoria <slug>`, `--sin-ocr`, `--json`.

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
- **Faltan normas del listado por descargar**: 124 normas únicas listadas frente
  a 120 documentos en disco, de los cuales 119 emparejan.
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
| `query.py` | Motor de recuperación + señal de confianza (CLI + `--json`) |
| `preguntar.py` | Misma recuperación, síntesis con Ollama local |
| `eval_retrieval.py` | Compuerta: recall@k + abstención (exit 1 si reprueba) |
| `actualizar-diario.js` | Pipeline diario: scrape → descarga → build → compuerta → deploy |
| `preguntas-doradas.json` | Set de evaluación: debe recuperar la fuente correcta |
| `preguntas-fuera-corpus.json` | Contra-set: debe declarar ausencia |
| `overrides.json` | Metadata curada a mano para documentos fuera del listado |
| `corpus/corpus.jsonl` | Pasajes indexados (generado) |
| `corpus/metadata.json` | Metadatos por documento con vigencia (generado) |
| `corpus/modificaciones.json` | Grafo de modificaciones (generado) |
| `corpus/indice.pkl` | Índice invertido serializado (generado) |
| `corpus/audit-report.md` | Auditoría de corpus (generado) |
