# Cambios del 17-10-2026: el corpus diario se actualiza de verdad

Rama `claude/integracion-pr2-pr6`: `main` + PR #2 (plan de lanzamiento,
dispositivos médicos) + PR #6 (alimentos) + este arreglo del pipeline.

## El diagnóstico

«Corpus diario» corría y commiteaba casi todos los días, pero el buscador no
avanzaba: 133 documentos y 124 normas del listado durante semanas. Había tres
causas:

1. **El listado del ISP no se mueve.** «Normativa ANAMED» tuvo las mismas 170
   filas, con el mismo hash, desde el 14-07-2026. Mientras tanto el ISP publicó
   en el Diario Oficial resoluciones que nunca llegaron a ese listado. Por
   ejemplo, la Res. Ex. 1.307/2026 de confianza regulatoria para biológicos.
   El scraper funcionaba bien; la fuente no cambiaba.
2. **El ISP no responde a GitHub los fines de semana.** Todas las corridas de
   sábado y domingo fallaban desde septiembre en el paso del TLS (timeouts), y
   el pipeline abortaba entero aunque la BCN respondiera normal.
3. **La reescritura diaria era cosmética.** Cada pasaje llevaba la fecha del
   snapshot del listado («snapshot 2026-10-15»). Esa fecha cambiaba todos los
   días, así que `corpus.jsonl` se reescribía entero (5.044 líneas) sin un
   cambio real, y Railway redesplegaba por nada.

## Qué cambia

- **`bcn_novedades.py`, una fuente que sí trae normas nuevas.** Usa el buscador
  de la BCN (el mismo que usa bcn.cl/leychile, sin clave):
  1. Busca los temas de ANAMED en el año en curso.
  2. Se queda con las normas del Minsal o del ISP no vistas, y excluye SEREMI,
     Superintendencia y servicios de salud.
  3. Lee su XML y las clasifica: relevante con su materia, o descartada con su
     motivo (aranceles, estructura orgánica, nombramientos, alertas
     sanitarias…).
  4. Las relevantes van a `fuentes-bcn-auto.json` y entran al corpus por
     `decretos_bcn.py`, con vigencia certificada por la BCN y vigilancia por
     artículo.
  - Los extractos del Diario Oficial entran avisando que el texto íntegro está
    en ispch.cl.
  - Estado y decisiones quedan en `registro-cambios/estado/bcn-novedades.json`.
    Para sacar una norma, se agrega su idNorma a `exclusiones`.
  - Primera corrida: 82 normas del Minsal y del ISP en 2026, **39
    incorporadas**, 36 descartadas con motivo, 5 que el corpus ya tenía. Entre
    las incorporadas:
    - los DS 8 y 59/2026, que modifican el RSA;
    - la NT 257 de terapias avanzadas;
    - las directrices de confianza regulatoria del ISP (registro, inspecciones,
      farmacovigilancia);
    - guías del ISP: homeopáticos, transporte de dispositivos con cadena de
      frío, investigación clínica de dispositivos, agua para uso farmacéutico;
    - lineamientos de productos farmacéuticos peligrosos;
    - las actualizaciones de folletos y los períodos de información pública de
      régimen de control.
- **El ISP caído no aborta.** El workflow avisa (`::warning::`) en vez de
  fallar. `actualizar-diario.js` sigue con el último listado conocido y los
  PDF en caché, se salta ANDID y el reintento de faltantes, y la compuerta
  decide si se publica. `estado-corpus.json` registra
  `isp.disponible/error/listado_sin_cambios_desde` y el resumen de
  `bcn_novedades`. Probado el mismo 17-10, con el ISP caído también desde
  Chile: la corrida completa pasó la compuerta y quedó lista para publicar.
- **Sin reescritura falsa.** El snapshot del listado guarda `contenidoDesde`,
  la fecha desde la que tiene este contenido, y la vigencia de cada pasaje dice
  «listado oficial ISP (sin cambios desde 2026-07-14)». `corpus.jsonl` solo
  cambia cuando cambia algo de verdad.

## Integración de los PR

- La base es `claude/pr2-verde-a-main`: el PR #2 con el verde neón, ya
  integrado el 07-10. Encima va `main`, que trae FDA, la agenda por ventanas y
  noticias. Conflictos resueltos:
  - la pestaña Chile/EE.UU. entra al hilo de conversación del asistente;
  - `/api/search` combina el cupo diario, la jurisdicción y la conversación;
  - `/api/responder` mantiene el corte de IA para la FDA y las búsquedas
    planificadas;
  - `eval_retrieval` mantiene la estructura de `main` (Chile + FDA) y agrega
    `pregunta_aplica` y `--detalle`;
  - el vigía revisa tanto `/api/salud` como la frescura de las noticias.
- **Migraciones:** las del PR #2 pasan a **0012-0014**, detrás de
  `0011_agenda_ventanas`, que ya está aplicada en producción. `migrate.mjs`
  las registra por nombre de archivo, así que se aplican al arrancar. Los
  snapshots de Drizzle quedaron re-encadenados y `drizzle-kit generate`
  responde «No schema changes».

## Verificación (local, con el corpus de la corrida)

| | Resultado |
|---|---|
| Corpus | 179 documentos, 3.627 pasajes. Ningún documento de producción se pierde; +46 nuevos |
| Chile recall@5 · abstención | 42/43 (la falla `cs-farmaceutico-direccion` ya existía) · 2/2 |
| FDA recall@5 · abstención | 21/21 · 4/4 |
| Dev · holdout (visible@3, verdes falsos) | 23/26, 0 · 16/17, 0 |
| Paridad Python ↔ TypeScript | idénticos en 77 preguntas |
| Web | tipos OK, lint sin errores, 75/75 pruebas, build de producción OK |

La compuerta también demostró que sirve: en una corrida con los PDF de
`otros/` como punteros LFS sin materializar, se negó a publicar.

## Pendiente

- Dos normas de 2026 cuyo XML la BCN todavía no sirve (Decreto Exento 15,
  Res. Ex. 2.053): se reintentan solas cada día.
- Las descripciones «Abre período de información pública que indica» son las
  que pone la BCN. El detalle está en el texto del pasaje.
- Revisar de vez en cuando `bcn-novedades.json`: el filtro de relevancia es
  por palabras clave.
