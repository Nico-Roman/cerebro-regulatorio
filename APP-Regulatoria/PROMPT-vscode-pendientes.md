# Prompt para Claude Code en VS Code — cerrar lo pendiente

> Ábrelo con VS Code apuntando a `C:\Users\nico2\Documents\Claude-Test\Asuntos-Regulatorios`
> (la carpeta ya es la raíz del repo). Pégale todo lo que está bajo la línea a
> Claude Code. Está en pasos numerados: pídele que se detenga y te avise al
> final de cada uno antes de seguir al siguiente — varios necesitan que tú
> verifiques algo fuera de VS Code (Railway, un servicio externo).

---

Trabajo en RegulaMED / Cerebro Regulatorio. Otra sesión de Claude (Cowork, en la
nube, sin red de salida ni git con credenciales) ya dejó hecho el trabajo de
fondo: subió la raíz del repo, migró el pipeline a GitHub Actions y separó salud
de frescura. Todo eso quedó en **4 commits locales, sin empujar**, porque esa
sesión no tenía cómo hacer `git push` ni correr el pipeline con red real. Eso es
lo que falta: verificar que lo que se escribió funciona de verdad y sacarlo de
"local" a "en producción".

## Qué se hizo y por qué (para que tengas el contexto completo)

El 7 de septiembre de 2026 el pipeline diario —que corría en el Programador de
tareas de este mismo PC— llevaba 8 días caído y nada se veía mal: el healthcheck
respondía 200, la compuerta de calidad en verde, la web sirviendo normal. Solo
que la normativa tenía 8 días de atraso y no había forma de saberlo. La causa de
fondo: **nada medía frescura, así que nada podía alarmarse por su ausencia.**

Encontrado eso, se corrigieron cuatro cosas, en cuatro commits:

1. `0387610` — la raíz del repo pasó de `APP-Regulatoria/web/` a la carpeta del
   proyecto completo (`git mv` con historial intacto, 63 renombres). Antes el
   pipeline (motor Python, scraper, bitácora) vivía fuera de git: sin historial,
   sin revisión, sin CI. Entraron también los 65 sidecars OCR de
   `ANAMED_Normativa/**/*.txt` — irrecuperables, no se pueden re-bajar del ISP,
   y hasta ese día existían en un solo disco sin respaldo. Los `.pdf` (306 MB)
   quedan fuera de git a propósito: se re-descargan solos.
2. `3bd8ab4` — `.github/workflows/corpus-diario.yml`: el pipeline corre en
   GitHub Actions a las 08:00 Chile en vez de depender de que este PC esté
   encendido. Las rutas en `build_corpus.py`, `norma_registry.py` y
   `actualizar-diario.js` se reescribieron para derivarse de la posición del
   archivo en el repo (antes usaban `parents[3]` + el literal
   `"Asuntos-Regulatorios"`, atado al árbol de carpetas de este PC específico).
3. `b920275` — `/api/estado` (nuevo) separado de `/api/health` (existente).
   `/api/health` sigue respondiendo según si el corpus está cargado en memoria
   — Railway lo usa para decidir tráfico, y no debe caer solo porque el corpus
   envejeció. `/api/estado` sí devuelve 503 si el corpus lleva más de 7 días sin
   regenerarse, y es ese el que hay que monitorear desde afuera. La fecha del
   corpus también quedó visible en `/normativa`.
4. `cfd164c` — la alerta de `registro-cambios/revisar-semanal.js` ahora manda a
   revisar GitHub Actions en vez del Programador de tareas de Windows.

Ninguno de los cuatro se probó con PyMuPDF real, red real, ni credenciales de
git reales — la sesión que los escribió no tenía nada de eso. Por diseño, tu
primer trabajo acá es verificar, no confiar.

## Invariantes que no se pueden romper

- El texto legal no se reescribe nunca; los defectos de OCR se señalan
  (`alertas_ocr`), jamás se corrigen en silencio.
- La vigencia la certifica solo el listado oficial del ISP.
- La compuerta de calidad (`eval_retrieval.py`, recall ≥90%, abstención 100%)
  manda: si reprueba, no se publica. No la debilites para que pase.
- `registro-cambios/` no es fuente normativa; nunca debe terminar indexada por
  `build_corpus.py`.

---

# Paso 1 · Verificar que el pipeline corre de verdad en este PC

1. `git log --oneline -6` — confirma que ves los 4 commits de arriba encima de
   `ea092ce feat(auth): registro obligatorio...`.
2. Corre el pipeline completo tal como lo haría GitHub Actions, para probar las
   rutas nuevas con PyMuPDF y red reales:
   ```
   node APP-Regulatoria/cerebro/actualizar-diario.js
   ```
   Tiene que: hacer scrape del listado ISP, reconciliar faltantes (paso 2b —
   nuevo, revisa que intente bajar la Resolución Exenta 873, que tenía un
   espacio final en el enlace), reconstruir el corpus, pasar la compuerta, y
   escribir `APP-Regulatoria/web/data/estado-corpus.json` con la fecha de hoy.
3. Si algo truena por una ruta que ya no resuelve bien: arréglalo ahí mismo,
   pero antes de tocar nada dime en qué archivo y por qué — puede ser una ruta
   que se me escapó al portar `build_corpus.py`/`norma_registry.py`.
4. **Detente acá y muéstrame el resumen de la corrida** (recall, abstención,
   cuántas normas recuperó del reintento) antes de seguir.

# Paso 2 · Empujar a GitHub

1. `git push` desde acá — la sesión que preparó todo esto no tenía credenciales.
2. Si el Paso 1 generó cambios nuevos (corpus regenerado, `estado-corpus.json`),
   son exactamente lo que ese commit diario haría: commitéalos con
   `chore(corpus): actualización manual de verificación YYYY-MM-DD` y empújalos
   también.
3. Ve a la pestaña **Actions** del repo en GitHub y confirma que el workflow
   "Corpus diario" aparece (no hace falta esperar a que dispare solo; puedes
   forzarlo con "Run workflow" para verlo correr una vez). **Avísame el
   resultado antes de seguir** — si falla en CI aunque haya funcionado acá, casi
   siempre es la caché de PDFs o una dependencia de sistema que Alpine/Ubuntu no
   trae por defecto.

# Paso 3 · Railway: cambiar el root directory

En el dashboard de Railway, proyecto `zoological-intuition` → servicio
`cerebro-regulatorio` → Settings → Source: cambiar **Root Directory** de vacío
(raíz del repo) a `APP-Regulatoria/web`. Esto no lo puede hacer Claude Code —
es la UI de Railway — así que hazlo tú y dispara un redeploy manual. Antes del
cambio el build va a fallar contra el commit nuevo (busca `Dockerfile` en la
raíz y ya no está ahí), pero el deploy anterior sigue sirviendo tráfico, así
que no hay caída entre medio.

Cuando el deploy esté verde, prueba en el navegador:
- `https://regulamed.cl/api/health` → `ok: true`
- `https://regulamed.cl/api/estado` → `ok: true`, con la fecha de hoy en
  `corpus.generado`
- `/normativa` → el aviso amarillo de "posiblemente desactualizado" NO debería
  aparecer si el corpus se regeneró hoy.

**Detente y confírmame que los tres responden bien antes de seguir.**

# Paso 4 · El monitor externo

Esto tampoco lo puede hacer Claude Code por ti (requiere crear una cuenta en un
servicio externo), pero puedes pedirle que te deje los pasos exactos en pantalla
si quieres ir siguiéndolos ahí mismo:

- UptimeRobot o Better Stack (plan gratuito).
- Monitor tipo HTTP(S), URL `https://regulamed.cl/api/estado`, intervalo 5 min,
  alerta cuando el código no sea 200.
- Notificación a tu correo (y a Telegram si ya tienes el bot de n8n con el que
  planeabas las alertas de uptime — revisa `PLAN-migracion-railway.md` sección
  "Fase 6").

Este es el testigo que de verdad no comparte suerte con este PC ni con GitHub
Actions: si ambos se caen a la vez, este es el único que te avisa.

# Paso 5 · Desactivar (o dejar como respaldo) la tarea de Windows

`actualizar-diario.js` ya detecta si corre en CI y se comporta distinto, así que
no hay urgencia en apagar la tarea del Programador de tareas — puede quedar
como respaldo silencioso. Pero si prefieres apagarla para no tener dos fuentes
de verdad: ábrela, y o bien deshabilítala o cámbiale el horario a una hora
después de las 08:00 Chile (11:00 UTC, cuando corre Actions) para que nunca
compitan por el mismo commit. Dime cuál prefieres y Claude Code te da el
comando `schtasks` exacto si quieres hacerlo por línea de comandos en vez de la
UI.

# Paso 6 · Limpieza de git

El filesystem montado en la sesión de Cowork dejó basura que no pudo borrar
(`Operation not permitted` en un VM sin permisos de root sobre esos archivos):
```
git status
```
Si aparece algo raro en `.git/locks-obsoletos/`, bórralo a mano (son locks
viejos, no forman parte del repo). Después:
```
git gc --prune=now
```
Limpia objetos temporales huérfanos (`.git/objects/**/tmp_obj_*`) que quedaron
de esos locks. **No hace falta** que me confirmes este paso, es limpieza pura.

---

## Cuando termines los 6 pasos

Quiero un resumen corto: qué verificaste, qué tuviste que corregir (si algo),
si el workflow de Actions corrió bien, y si el monitor externo quedó armado.
Con eso la vigilancia queda completa: GitHub Actions mantiene el corpus al día
sin depender de este PC, `/api/estado` expone la frescura, y el monitor externo
es el testigo que avisa si las dos cosas de arriba fallan a la vez.

**Lo que queda fuera de este prompt a propósito:** mover `registro-cambios/` a
Postgres (Fase D del plan anterior). Depende de que Drizzle y la base estén
funcionando en producción — encaja mejor junto a la Fase 3 de
`PLAN-migracion-railway.md` (panel de leads), cuando armes esa parte del stack.
No la adelantes por tu cuenta.
