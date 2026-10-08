# Sección EE.UU. (FDA) — 21 CFR

Encendida el **2026-10-08** como pestaña «EE.UU. · FDA» del buscador, con
**índice propio**. Cómo quedó conectada y qué se decidió está en § 6; lo que
falta, en § 5.

---

## 1 · Qué se construyó

| | |
|---|---|
| Partes del 21 CFR curadas | **36** de 275 (ver `partes-prioritarias.json`) |
| Documentos en el corpus FDA | 36 |
| Pasajes | **2.346** |
| Versión del CFR | enmiendas incorporadas al **2026-10-06** (se actualiza a diario) |
| Esquema | idéntico al del corpus chileno |
| Publicado | **sí**, en `web/data/corpus-fda.jsonl` |

```bash
python ecfr.py --inventario   # qué partes entran y por qué
python ecfr.py --descargar    # baja las 36 partes del eCFR
python ecfr.py --construir    # arma fda/corpus/corpus-fda.jsonl
python ecfr.py --vigilar      # compara con la corrida anterior
```

El esquema es idéntico al del corpus chileno a propósito: si algún día esto se
enciende, el motor de recuperación y la web no necesitan enterarse de que la
fuente es otra. Lo único que las separa es `categoria`, que acá empieza con
`fda_`.

Prueba de recuperación sobre el corpus FDA (hecha, no prometida):

| Consulta | Primer resultado |
|---|---|
| *requirements for the quality control unit* | 21 CFR § 211.22 |
| *electronic signature requirements for records* | 21 CFR § 11.50 |
| *bioequivalence study requirements for generic drugs* | 21 CFR § 320.30 |

---

## 2 · Inventario de fuentes

Todas se probaron contra la red el 2026-09-09. Las que quedaron fuera están
abajo, con el motivo.

### 2.1 · eCFR — el 21 CFR consolidado · **INGESTADO**

- **API**: `https://www.ecfr.gov/api/versioner/v1`
- **Qué da**: el CFR vigente y consolidado. `titles.json` trae
  `latest_amended_on` por título (la señal de frescura);
  `structure/{fecha}/title-21.json` el árbol completo (2,6 MB);
  `full/{fecha}/title-21.xml?part=NNN` el texto de una parte.
- **Estructura**: `DIV5` (parte) › `DIV6` (subparte) › `DIV8` (sección), más
  `CITA` con la historia de enmiendas de cada sección.
- **Tamaño**: título 21 completo = 275 partes, 8.408 secciones. Las 36 curadas
  son 3,2 MB de XML.
- **Licencia**: obra del gobierno de EE.UU., dominio público.
- **Trampa**: `full/` responde **406** si el request no acepta compresión, y el
  mensaje solo aparece en el cuerpo del error. Hay que mandar
  `Accept-Encoding: gzip`.
- **Por qué es la fuente principal**: es al 21 CFR lo que la BCN es al Código
  Sanitario —texto consolidado, vigente, estructurado y fechado—, y por las
  mismas tres razones: troceado por sección sin heurística, vigencia
  certificada en origen, y fecha de versión para vigilar cambios.

### 2.2 · Guidance Documents de la FDA · **INVESTIGADO, NO INGESTADO**

- **Índice**: `https://www.fda.gov/files/api/datatables/static/search-for-guidance.json`
- **Qué da**: **2.787** guías con metadatos utilizables — título, URL, fecha de
  emisión, oficina emisora, centro (CDER/CBER/CDRH), estado *Final* o *Draft*,
  número de docket, producto regulado y temas.
- **Por qué importa**: en la práctica regulatoria de EE.UU. las guías pesan
  tanto como el reglamento. Un buscador del 21 CFR sin guías responde la mitad.
- **Por qué no está ingestado todavía**: el índice trae la ficha, no el texto;
  el contenido está en PDF, uno por guía. Bajar 2.787 PDF y extraerles el texto
  es el mismo problema —con OCR incluido— que ya resolvió el pipeline chileno,
  pero a diez veces la escala. Es la siguiente pieza, y es la más grande.
- **Distinción que no se puede perder**: una guía **no es vinculante** («contains
  nonbinding recommendations»). Si entra al corpus tiene que entrar marcada, o
  el buscador va a presentar una recomendación con la misma cara que una
  obligación. Eso sería peor que no tenerla.

### 2.3 · Federal Register · **INVESTIGADO, NO INGESTADO**

- **API**: `https://www.federalregister.gov/api/v1/documents.json`
  con `conditions[agencies][]=food-and-drug-administration`
- **Qué da**: **3.661** reglas finales de la FDA, más propuestas y avisos, con
  texto completo y fechas de vigencia.
- **Para qué serviría**: es el canal por donde el CFR *cambia*. El eCFR muestra
  el estado; el Federal Register muestra el movimiento, incluida la regla
  propuesta que todavía no es derecho pero ya se puede comentar.
- **Uso previsto**: alimentar la vigilancia con el *porqué* de cada cambio, no
  el corpus de citas.

### 2.4 · openFDA · **INVESTIGADO, FUERA DE ALCANCE POR AHORA**

- **API**: `https://api.fda.gov` (labels, eventos adversos, recalls, 510(k), PMA)
- **Escala**: 262.758 fichas de producto en `drug/label`, actualizado a diario.
- **Por qué queda fuera**: son datos de producto, no texto normativo. Este
  buscador promete «el pasaje normativo exacto con cita trazable»; un inserto de
  producto no es una norma y mezclarlos degrada esa promesa.
- **Su propio disclaimer** —«do not rely on openFDA to make decisions regarding
  medical care»— es razón suficiente para no citarlo como fuente regulatoria.

### 2.5 · Lo que queda anotado para después

- **FD&C Act** (la ley, no el reglamento) — el 21 CFR desarrolla el 21 U.S.C.
  El equivalente de haber traído el Código Sanitario. Fuente: `uscode.house.gov`.
- **Orange Book / Purple Book** — equivalencia terapéutica y biosimilares.
- **ICH** — Q7 a Q14, E6(R3), M4 (CTD). No son FDA, pero son la lengua franca
  entre la FDA, la EMA y el ISP.

---

## 3 · Las 36 partes y por qué

El detalle, con el motivo de cada una, está en `partes-prioritarias.json`.
Ampliar la lista es editar ese archivo: no hay nada más que tocar.

| Grupo | Partes |
|---|---|
| GMP | 210, 211, 212 |
| Calidad y datos | 11 (registros/firmas electrónicas), 58 (GLP) |
| Ensayos clínicos | 50, 54, 56, 312 |
| Registro | 314 (NDA/ANDA), 316 (huérfanos) |
| Bioequivalencia | 320 |
| Medicamentos | 310, 330 |
| Etiquetado y promoción | 201, 202, 206 |
| Distribución | 203 |
| Establecimientos | 207 |
| Biológicos | 600, 601, 610, 1271 |
| Cosméticos | 700, 701, 740 |
| Dispositivos | 801, 803, 806, 807, 809, 812, 814, 820, 822, 830 |

Se dejaron fuera a propósito los aditivos alimentarios, el tabaco, la salud
radiológica y los medicamentos veterinarios: son la mayor parte del título 21 y
no tocan el trabajo de este proyecto.

> **Hallazgo que conviene no pasar por alto.** La Parte 820 ya **no** es la
> vieja *Quality System Regulation*. Desde `89 FR 7523` (2 de febrero de 2024)
> es la **Quality Management System Regulation**, que incorpora ISO 13485 por
> referencia; por eso bajó a nueve secciones. Cualquiera que cite «21 CFR 820»
> de memoria va a estar citando un texto que ya no existe. Es justamente la
> clase de error que un buscador con texto consolidado y fechado evita.

---

## 4 · Vigilancia de cambios

Mismo principio que el Código Sanitario, con una vuelta más. El eCFR da
`latest_amended_on` por título, pero no por sección, así que la comparación se
hace contra una **huella del texto de cada sección** más su historia de
enmiendas. Si el CFR cambia, el diff dice qué secciones se movieron, cuáles
nacieron y cuáles desaparecieron.

La huella es `sha1`, no el `hash()` de Python. No es un detalle de estilo: el
`hash()` de Python lleva una semilla aleatoria por proceso, así que con él la
vigilancia habría reportado que cambió todo, todos los días —un falso positivo
que además tapa los cambios de verdad. Verificado: dos corridas seguidas en
procesos distintos dicen «sin cambios».

La línea base vive en `estado-vigilancia.json`, y ese archivo **sí** se
versiona. `fuentes/` y `corpus/` no: son 8 MB de espejo de una API pública que
se rehacen con dos comandos. Lo que se publica es la copia en
`web/data/corpus-fda.jsonl`.

La primera corrida después de un mes (2026-09-08 → 2026-10-06) detectó 17
secciones enmendadas en las Partes 312 (IND), 314 (NDA) y 601 (biológicos).

---

## 5 · Cómo quedó encendida (2026-10-08)

Las cuatro decisiones que el README pedía antes de encender:

1. **Dos índices, no uno.** `web/data/corpus.jsonl` (Chile) y
   `web/data/corpus-fda.jsonl` (EE.UU.) se cargan por separado
   (`indice.load_fda()` en Python, `responder(q, { jurisdiccion: "fda" })` en
   la web). Un solo índice habría movido el IDF de todo el corpus chileno y
   dejado que una pregunta en español recuperara inglés. Verificado: las 78
   preguntas de los sets chilenos devuelven exactamente lo mismo que antes,
   byte a byte.
2. **Preguntas doradas FDA y su compuerta.** `preguntas-doradas-fda.json` (21
   preguntas, los doce grupos de partes) y `preguntas-fuera-corpus-fda.json`
   (4). `eval_retrieval.py` mide los dos corpus y `eval_respuestas.py` exige
   paridad Python/TypeScript también en las preguntas FDA. Al encender:
   recall@5 21/21, abstención 4/4. Si la FDA reprueba, el pipeline publica
   igual el corpus chileno y deja servido el 21 CFR de ayer (`pasa_cl`).
3. **Aviso de jurisdicción.** En tres lugares: un recuadro fijo en la pestaña
   FDA, el primer aviso de cada respuesta del 21 CFR («no rige en Chile») y la
   etiqueta «EE.UU. (FDA) · …» de cada tarjeta.
4. **Lo no vinculante.** El 21 CFR es reglamento: obliga en EE.UU. Las guías
   («nonbinding recommendations») siguen **fuera**; el recuadro de la pestaña
   lo dice. Cuando entren, tienen que traer su propia marca (ver § 6).

Cómo se comporta el motor sobre el 21 CFR:

- **Preguntas en inglés.** El vocabulario, los tipos de pregunta y las reglas
  de fuera de alcance son del español y no se aplican al índice FDA; sí se
  descartan de la pregunta las palabras vacías del inglés (`STOPWORDS_EN`).
  Sin eso, «How do I register a glucometer in Chile?» salía en verde por «How
  do I register». Una pregunta en español se abstiene y pide inglés.
- **Nunca en verde, por ahora.** Los umbrales del verde se calibraron con
  preguntas en español validadas por un QF. Sin un set así para el 21 CFR,
  «What is a combination product?» salía en verde con una sección de
  bioequivalencia (la definición vive en la Parte 3, que no está). La sección
  FDA llega como máximo a «parcial».
- **Cita estadounidense:** «21 CFR § 211.22», y «21 CFR Part 1271» sin
  separador de miles.
- **Sin borrador con IA.** El prompt y el verificador de citas son para la
  normativa chilena; `/api/search` devuelve `iaDisponible: false` en la FDA y
  `/api/responder` rechaza esas consultas.

---

## 6 · Lo que todavía no está

1. **Calibrar el verde en inglés.** Un set de preguntas reales sobre el 21 CFR
   validado por un QF que trabaje con FDA; con él se puede quitar el tope a
   «parcial».
2. **Preguntas en español.** Hoy hay que preguntar en inglés. Un glosario
   español → inglés (BPM → current good manufacturing practice, firma
   electrónica → electronic signature, …) aplicado solo al índice FDA lo
   resolvería sin tocar el chileno.
3. **Las guías** (§ 2.2), con la marca de no vinculante en la tarjeta y en el
   aviso de la respuesta. Es la pieza grande.
4. **La Parte 3** (productos combinados) y las demás que pidan las consultas
   reales: ampliar es editar `partes-prioritarias.json` y sumar su pregunta
   dorada.
5. **Frescura en `/api/estado`.** `estado-corpus.json` ya trae el bloque `fda`
   (versión, documentos, pasajes) y la pantalla muestra la fecha de las
   enmiendas, pero `/api/estado` y el vigía de frescura todavía no lo miran.
