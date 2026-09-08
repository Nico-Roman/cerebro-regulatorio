# RegulaMED · Cerebro Regulatorio

Buscador de normativa farmacéutica y sanitaria chilena (ISP/ANAMED) que responde
con el **texto legal exacto y cita trazable a la fuente oficial**. Si la respuesta
no está en el corpus, lo declara en vez de inventarla.

En producción: <https://regulamed.cl>

## Estructura

| Carpeta | Qué es |
|---|---|
| `APP-Regulatoria/web/` | La app Next.js que se despliega en Railway. **Root directory del servicio.** |
| `APP-Regulatoria/cerebro/` | Motor de recuperación BM25 en Python + el pipeline diario. Ver su [README](APP-Regulatoria/cerebro/README.md). |
| `vigilancia-isp/` | Scraper del listado oficial de normativa ANAMED del ISP. |
| `registro-cambios/` | Bitácora append-only de cambios normativos. **No es fuente normativa**, ver su [README](registro-cambios/README.md). |
| `ANAMED_Normativa/` | Los PDF de las normas. Los `.pdf` no se versionan (306 MB, se rebajan del ISP); los sidecars `.txt` de OCR **sí**, porque no se pueden regenerar. |
| `.github/workflows/` | El pipeline diario del corpus. |

## Operación

El corpus se reconstruye a diario en GitHub Actions
([`corpus-diario.yml`](.github/workflows/corpus-diario.yml)): scrape del listado
oficial → descarga de lo que falte → reconstrucción del índice → **compuerta de
calidad** → commit → redeploy automático en Railway.

La compuerta (`eval_retrieval.py`) mide dos cosas y bloquea la publicación si
alguna reprueba: recall ≥ 90% contra el set de preguntas doradas, y 100% de
abstención en consultas fuera del corpus. Un buscador legal falla de dos maneras
distintas, y subir el recall a costa de responder siempre pasaría media
evaluación mientras empeora la herramienta.

### Salud vs. frescura

Dos endpoints, separados a propósito:

| Endpoint | Pregunta que responde | Quién lo consulta |
|---|---|---|
| `/api/health` | ¿Este contenedor puede servir? | Railway, para decidir el tráfico |
| `/api/estado` | ¿Los datos están al día? | El monitor externo |

`/api/estado` devuelve **503** cuando el corpus lleva más de 7 días sin
actualizarse. `/api/health` nunca baja por eso: sacar de circulación un servicio
que funciona, por tener normativa con atraso, es un remedio peor que la
enfermedad.

**Configurar el monitor** (UptimeRobot o Better Stack, plan gratuito): un chequeo
HTTP cada 5 minutos a `https://regulamed.cl/api/estado`, alerta cuando el código
no sea 200. Eso cubre las dos fallas a la vez: el sitio caído y el sitio sirviendo
normativa vieja.

### Por qué está montado así

En septiembre de 2026 el pipeline corría en el Programador de tareas de un
notebook. Estuvo 8 días caído y **nada lo notó**: el healthcheck respondía 200,
la compuerta estaba en verde y la web servía normativa con 8 días de atraso como
si estuviera al día.

La regla que ordena todo lo de arriba:

> Nada puede reportar salud sin reportar frescura, y la ausencia de una señal
> tiene que ser ella misma una alarma.

De ahí salen las tres defensas del diseño actual: un **latido con testigo que no
comparta suerte** (el monitor externo, no un script en la misma máquina),
**reconciliación en vez de solo eventos** (el pipeline compara el listado
completo contra el disco, no solo lo que cambió hoy — así es como una descarga
fallida dejaba de reintentarse para siempre) y **evidencia append-only** (el
registro de cambios no se sobrescribe nunca).
