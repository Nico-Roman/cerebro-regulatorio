# Prompt para Claude Code en VS Code — sacar la vigilancia del PC

> Copia todo lo que está bajo la línea y pégalo en Claude Code dentro de VS Code,
> con el repo `cerebro-regulatorio` abierto. Está escrito para ejecutarse por
> fases: pídele que pare al final de cada una y verifique antes de seguir.

---

Trabajo en RegulaMED / Cerebro Regulatorio: un buscador de normativa farmacéutica
chilena (ANAMED/ISP) que responde con citas trazables al texto legal. Está en
producción en Railway. Necesito eliminar una clase de falla que ya me mordió.

## El problema que estamos resolviendo

El pipeline que mantiene el corpus al día (`actualizar-diario.js`) corre en el
Programador de tareas de mi PC con Windows. El 7 de septiembre descubrí que
llevaba 8 días sin correr. Nada se veía mal: el healthcheck respondía 200, la
compuerta de calidad estaba en verde, la web servía respuestas normales. Solo
que la normativa tenía 8 días de atraso y nadie podía saberlo.

Encontré tres instancias de la misma falla:

1. **El pipeline se cae y el sistema se sigue viendo sano.** Nada mide la
   frescura, así que nada puede alarmarse por la falta de frescura.
2. **Una descarga que falla una vez no se reintenta nunca.** El pipeline solo
   descargaba las normas que aparecían en el diff del día; una norma que falló
   salía del diff al día siguiente y quedaba invisible para siempre. Así llegué
   a 124 normas en el listado oficial contra 120 documentos indexados.
   (Ya lo arreglé con un paso 2b de reconciliación completa listado ↔ disco.)
3. **La evidencia se sobrescribía.** `snapshots/last-diff.json` se pisaba en
   cada corrida, así que no quedaba rastro de *qué* cambió, solo de cuántas
   normas cambiaron. (Ya lo arreglé con `registro-cambios/`, una bitácora
   append-only fuera del corpus.)

La regla que quiero que guíe todo lo que hagas acá:

> **Nada puede reportar salud sin reportar frescura, y la ausencia de una señal
> tiene que ser ella misma una alarma.**

## Contexto del repo

- El repo `Nico-Roman/cerebro-regulatorio` tiene su raíz en la carpeta `web/`
  (Next.js 16 + React 19 + Tailwind 4, App Router). Railway despliega desde
  `main`, target port 8080, healthcheck en `/api/health`.
- El pipeline vive FUERA del repo, sin versionar, en
  `C:\Users\nico2\Documents\Claude-Test\Asuntos-Regulatorios\`:
  - `ANAMED_Normativa/<categoria>/*.pdf` — 164 PDFs (306 MB) + 65 sidecars OCR
    `.txt` (488 KB) hechos a mano. **Los sidecars son irrecuperables**: no se
    pueden volver a bajar del ISP y existen en un solo disco.
  - `APP-Regulatoria/cerebro/` — `build_corpus.py`, `query.py`, `indice.py`,
    `norma_registry.py`, `modificaciones.py`, `eval_retrieval.py`,
    `actualizar-diario.js`. Única dependencia externa: PyMuPDF (`fitz`).
  - `vigilancia-isp/` — `check-normativa.js` (scrape del listado oficial ISP).
  - `registro-cambios/` — bitácora append-only + `revisar-semanal.js`.
- El pipeline diario hace: scrape → descarga faltantes → resumen con Ollama →
  `build_corpus.py` → compuerta `eval_retrieval.py` (recall ≥90% y abstención
  100%, exit 1 si reprueba) → copia `corpus.jsonl` a `web/data/` → commit+push
  → redeploy en Railway.

## Invariantes que NO se pueden romper

- **El texto legal no se reescribe nunca.** Los defectos de OCR se señalan
  (`alertas_ocr`), jamás se corrigen en silencio.
- **La vigencia la certifica solo el listado oficial del ISP.** Un texto que no
  viene del ISP no puede heredar esa vigencia.
- **La compuerta de calidad manda.** Si `eval_retrieval.py` reprueba, no se
  publica. No la debilites para que pase el pipeline.
- **`registro-cambios/` no es fuente normativa y no puede terminar indexada.**
  `build_corpus.py` solo hace glob de `ANAMED_Normativa/*/*.pdf`; mantenlo así.

---

# Fase A · Poner el pipeline bajo control de versiones

Hoy el código crítico del proyecto no tiene historial, ni revisión, ni CI. Y los
65 sidecars OCR existen en un solo disco: si ese disco muere, se pierden y no se
pueden regenerar desde el ISP. Esto es más urgente que cualquier automatización.

1. Reestructura el repo para que la raíz sea la carpeta del proyecto completo y
   `web/` pase a ser un subdirectorio, conservando el historial de git
   (`git mv`, no borrar y recrear). La estructura objetivo:

   ```
   /web/                  ← la app Next.js (antes era la raíz)
   /cerebro/              ← el motor Python
   /vigilancia-isp/       ← el scraper
   /registro-cambios/     ← la bitácora
   /normativa/            ← los sidecars OCR (.txt), NO los PDFs
   /.github/workflows/
   ```

2. `.gitignore`: excluye `*.pdf` (306 MB no van a git) e **incluye
   explícitamente los `.txt`**. Deja un comentario en el archivo explicando por
   qué: los PDFs se rebajan del ISP, los sidecars OCR no.

3. Commitea los 65 sidecars.

4. Ajusta Railway: root directory `web/`, y el `Dockerfile` sigue quedando
   dentro de `web/`. Documenta el cambio en el README. **Detente acá y avísame
   para que yo verifique en Railway que el deploy sigue verde antes de seguir.**

# Fase B · Mover el pipeline a GitHub Actions

El objetivo es que el corpus deje de depender de que mi notebook esté encendido.
Usa GitHub Actions, no un cron de Railway: replica exactamente lo que ya
funciona (build → commit → push → redeploy), es gratis en repo público (voy a
liberar esto como open source), me manda correo cuando falla, y guarda logs de
cada corrida.

1. Crea `.github/workflows/corpus-diario.yml`:
   - `schedule: cron: "0 11 * * *"` (08:00 de Chile) + `workflow_dispatch`.
   - Python 3 + PyMuPDF, Node 22.
   - `actions/cache` para `normativa/**/*.pdf`, con clave derivada del
     `contentHash` del snapshot del listado. Al restaurar, corre el paso de
     reconciliación (listado completo ↔ disco) para bajar lo que falte: con
     caché son 0 descargas, sin caché baja los 164 desde el ISP.
   - Corre `build_corpus.py`, después `eval_retrieval.py`. **Si la compuerta
     reprueba, el job falla y no commitea nada.**
   - Si pasa: commit de `web/data/corpus.jsonl` y de los archivos de
     `registro-cambios/` que hayan cambiado, con mensaje
     `chore(corpus): actualización automática YYYY-MM-DD`.
   - Sin Ollama: ese paso era local. Déjalo fuera por ahora; el resumen en prosa
     lo hace la revisión semanal.

2. Adapta `actualizar-diario.js` para que funcione en los dos entornos (mi PC y
   el runner): rutas relativas a la raíz del repo, y que el paso de `git push`
   se salte cuando corre en CI (ahí commitea el workflow). No dupliques la
   lógica en un script nuevo: un solo pipeline, dos entornos.

3. Deja `actualizar-diario.js` corriendo en mi PC como respaldo, pero que
   detecte si el corpus ya fue actualizado hoy por CI y no haga nada.

# Fase C · Que la falta de frescura sea imposible de ocultar

1. `web/app/api/health/route.ts` hoy responde 200 si el corpus está cargado en
   memoria — o sea, un corpus de hace tres meses pasa el healthcheck perfecto.
   Agrégale la frescura: lee la fecha de generación del corpus y devuelve
   `generado`, `dias_desde_generacion` y `fresco: boolean`. Sobre 3 días,
   `fresco: false`. Sobre 7 días, HTTP 503.

   Cuidado con el matiz: Railway usa `/api/health` para decidir si el contenedor
   recibe tráfico. Un 503 por corpus viejo tumbaría el sitio, que es peor que
   servir normativa con atraso. Sepáralos: `/api/health` (¿el contenedor sirve?)
   se queda como está para Railway, y crea `/api/estado` (¿los datos están al
   día?) que es el que devuelve 503 y el que va a monitorear el uptime externo.
   Explica esa separación en un comentario.

2. En `/normativa`, muestra de forma visible "Corpus actualizado al DD-MM-YYYY".
   Si tiene más de 7 días, un aviso claro de que la información puede estar
   desactualizada. Un usuario que ve la fecha es el detector de fallas más
   barato que existe.

3. Documenta en el README cómo enchufar un monitor externo gratuito
   (UptimeRobot o Better Stack) a `/api/estado`.

# Fase D · El registro de cambios a Postgres

Esta fase conecta con la funcionalidad 4 del PRD ("alertas de cambios normativos
por suscripción a tema"): esa feature ES este registro. Mientras viva como un
`.jsonl` en mi notebook no puede alimentarla.

1. Tabla `cambio_normativo` con Drizzle: `id`, `detectado_el`, `tipo_evento`
   (`norma_nueva` | `norma_modificada` | `norma_fuera_del_listado` |
   `pendiente`), `norma`, `categoria`, `campos_jsonb`, `enlace`.
2. Un paso del workflow que inserta en Postgres los cambios nuevos del día
   (idempotente: si vuelve a correr el mismo día no duplica).
3. Ruta `/api/cambios` que los devuelve paginados y por categoría.
4. `registro-cambios/cambios.jsonl` **se mantiene** como bitácora local
   append-only del pipeline. Postgres es la vista consultable, el JSONL es la
   evidencia. No borres una por tener la otra.

---

## Cómo quiero que trabajes

- Una fase a la vez. Al terminar cada una, para, dime qué verificar y espérame.
- Antes de tocar el pipeline, léelo completo: `cerebro/README.md` explica el
  porqué de cada decisión (metadatos desde el listado oficial, vigencia por
  disposición, colapso de copias, señal de confianza). Si algo de lo que te pido
  contradice una de esas decisiones, dímelo en vez de aplicarlo.
- No agregues embeddings ni re-ranking semántico. Están postergados a propósito:
  los errores que quedan vienen de metadatos y OCR, y sumar semántica encima
  produce respuestas equivocadas más convincentes.
- Commits chicos y con mensaje que explique el *por qué*, no el qué.
