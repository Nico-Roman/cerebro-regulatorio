# Pendientes verificados — 8 de septiembre de 2026 (tarde)

Este documento reemplaza a `SUPUESTOS-2026-09-08.md` como lista de trabajo.
Aquel se escribió sin red y sin base de datos, así que varias de sus
afirmaciones eran suposiciones. Acá cada línea está **verificada contra
producción**, y se dice con qué comprobación.

---

## 1 · Corrección de rumbo: dónde está la app de verdad

`regulamed.cl` **no sirve la aplicación**. Resuelve a Vercel
(`64.29.17.1`, `216.198.79.65`) y devuelve un deploy antiguo:
`/api/estado`, `/admin` y `/agenda` responden **404** ahí.

La app viva está en Railway:

> **https://cerebro-regulatorio-production.up.railway.app**

Esto convierte el DNS —que en el documento anterior era el punto 8 de 8— en
**el bloqueo principal**. Todo lo construido en las Fases 2 a 5 funciona;
simplemente no se llega a ello por el dominio.

## 2 · Lo que sí quedó confirmado (no eran suposiciones)

| Comprobación | Resultado |
|---|---|
| `/api/estado` en Railway | `ok:true`, corpus 2026-09-07, 1 día, 2 584 chunks |
| `/api/health` | `ok:true` |
| `/normativa`, `/admin`, `/perfil` | 307 → `/ingresar` (el registro obligatorio funciona) |
| Migraciones `0001`–`0003` | **aplicadas contra la base real**: el `CMD` del Dockerfile corre `migrate.mjs` antes de `server.js`, así que un fallo habría dejado el contenedor sin arrancar |
| SQL de migraciones vs. `lib/db/schema.ts` | 10 tablas, **coinciden columna por columna** |
| `tsc --noEmit` | limpio |
| `next build` con red real | verde (el build anterior se hizo con las fuentes stubbeadas) |
| Los 3 commits de Fases 3–5 | **ya estaban en GitHub**; era el ref local `origin/main` el que estaba viejo |

## 3 · Cosas del documento anterior que ya no aplican

- **Punto 7 — "no hay pantalla en `/admin` para editar la agenda".** Sí la hay:
  `app/admin/agenda/page.tsx` con su API en `app/api/admin/agenda/route.ts`.
- **`web-src-claude.tgz`** — borrado.
- **Locks de git** — borrados. `main.lock` apuntaba a un commit huérfano
  (`1490083`); se verificó que su árbol era **idéntico** al que sí quedó en
  `main` (`dceab5d`) antes de eliminarlo. `git gc` limpió 110 objetos
  temporales.

## 4 · Bugs encontrados y corregidos

### 4.1 · El ISP corta por User-Agent, no por IP `[corregido]`

El workflow `corpus-diario.yml` fallaba en el paso de verificación TLS con
`curl: (52) Empty reply from server`. Se había atribuido a un WAF que rechaza
IPs de datacenter, y por eso el `schedule` estaba desactivado y se creó
`corpus-diario-local.yml` para un runner self-hosted en el PC.

**El diagnóstico estaba incompleto.** Desde una IP residencial chilena se
reprodujo el mismo `curl 52` sin User-Agent de navegador, y `200 OK` con él,
tres veces seguidas. El paso de verificación no mandaba ninguno; el scraper sí.
Es decir: el job moría antes de que el scraper llegara a intentarlo.

Con el UA agregado, el paso **pasó por primera vez desde un runner de GitHub**.

### 4.2 · Los enlaces del ISP no se escapaban `[corregido]`

Con lo anterior resuelto, la corrida llegó más lejos y falló en la compuerta de
calidad con `recall@5: 0/16`. La causa: de las 124 normas del listado, **132
enlaces distintos** fallaban con `curl exit 3` ("URL rejected: malformed
input"), porque el ISP los publica con espacios y acentos sin escapar
(`…/Resolución Exenta 1.777.pdf`). El corpus se armó con 28 documentos en vez
de 121, y la compuerta lo frenó.

**La compuerta hizo exactamente lo que debía. El error estaba antes.**

Se agregó `urlSegura()` en `actualizar-diario.js`: escapa solo espacios,
no-ASCII y un `%` suelto, y deja intactos los `%XX` ya presentes (idempotente).
Verificado contra una muestra de 12 de los 132: **12/12 responden 200 con PDF
real**, de 36 KB a 3,4 MB.

**Consecuencia de fondo:** hasta ahora el corpus solo se armaba completo en el
PC que ya tenía los 306 MB de PDF bajados a mano. Ésa era la razón real para el
runner self-hosted — no el WAF. Con esto, el corpus se puede reconstruir desde
cero en cualquier máquina.

### 4.3 · `.env.local` tenía nombres de variable muertos `[corregido]`

El archivo traía `GOOGLE_AGENDA_CLIENT_ID`, `GOOGLE_AGENDA_CLIENT_SECRET` y
`GROQ_API_KEY`, pero el código lee `GOOGLE_CAL_CLIENT_ID`,
`GOOGLE_CAL_CLIENT_SECRET` y `LLM_API_KEY`. `scripts/google-auth.mjs` habría
fallado con "Falta GOOGLE_CAL_CLIENT_ID" incluso después de pegar las
credenciales correctas. Renombradas; agregadas `LLM_BASE_URL`, `CRON_SECRET`,
`RESUMEN_TO`, `AUTH_MAGIC_LINK`. Respaldo en `.env.local.bak-2026-09-08`.

Quedan en el archivo, sin uso en el código: `LLM_PROVIDER`, `LLM_CUOTA_DIARIA`,
`AGENDA_TZ`, `GOOGLE_GENERATIVE_AI_API_KEY`, `SENTRY_DSN`, `RAILWAY_TOKEN`
(este último, además, ya no es válido: la API de Railway lo rechaza).

### 4.4 · `vigia-frescura.yml` habría fallado siempre `[corregido]`

Estaba sin commitear y apuntaba a `https://regulamed.cl/api/estado` —hoy
Vercel, 404— corriendo cada 6 horas **y en cada push**. Su endpoint ahora sale
de la variable de repo `ESTADO_URL`, con el dominio de Railway por defecto.

---

# Los pasos que faltan, en orden

El orden importa: cada uno desbloquea al siguiente.

## Paso 1 · Google OAuth del login `[te toca a ti]`

Sin esto **nadie entra al buscador, tú incluido**. Es lo primero.

1. Google Cloud Console → APIs y servicios → Credenciales → Crear credenciales →
   **ID de cliente de OAuth** → Aplicación web.
2. En "URI de redirección autorizados" pon **las tres**, para poder probar antes
   y después del cambio de DNS:
   ```
   https://cerebro-regulatorio-production.up.railway.app/api/auth/callback/google
   https://regulamed.cl/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```
3. En Railway → servicio `cerebro-regulatorio` → Variables:
   `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
4. Verifica entrando a
   `https://cerebro-regulatorio-production.up.railway.app/ingresar`.

Comprueba también que `ADMIN_EMAILS` en Railway incluya tu correo, o `/admin`
te va a rechazar aunque entres bien.

## Paso 2 · Apuntar regulamed.cl a Railway `[te toca a ti]`

Recién cuando el Paso 1 funcione, para no dejar el dominio apuntando a algo
donde no puedes entrar.

1. **Railway** → servicio → Settings → Networking → Custom Domain: agrega
   `regulamed.cl` y `www.regulamed.cl`. Railway te da un destino CNAME.
2. **En tu registrador**, reemplaza los registros actuales (los `A` que hoy van
   a Vercel) por lo que indique Railway.
3. **Antes de que propague**, cambia en Railway:
   - `NEXT_PUBLIC_SITE_URL` → `https://regulamed.cl`
   - `BETTER_AUTH_URL` → `https://regulamed.cl`

   > `NEXT_PUBLIC_*` se incrusta **en el build**, no en runtime (lo pasa el
   > `ARG` del Dockerfile). Cambiarla exige **redeploy**, no basta reiniciar.
   > Hoy está puesta al dominio de Railway: se ve en el `<link rel="canonical">`
   > de cualquier página.
4. En Vercel, deja el proyecto viejo con un 301 a `regulamed.cl` o pausa el
   dominio, para que no queden dos sitios sirviendo lo mismo.
5. Cuando responda: GitHub → repo → Settings → Secrets and variables → Actions →
   **Variables** → nueva variable `ESTADO_URL` =
   `https://regulamed.cl/api/estado`. El vigía la toma sin necesidad de commit.

## Paso 3 · Monitor externo `[te toca a ti]`

UptimeRobot o Better Stack, plan gratuito. Monitor HTTP(S) sobre
`/api/estado`, cada 5 minutos, alerta cuando el código no sea 200.

Apúntalo a **la URL de Railway** hasta que el Paso 2 esté propagado; después
cámbialo a `https://regulamed.cl/api/estado`.

## Paso 4 · Backups de Postgres `[te toca a ti]`

Railway → servicio **Postgres** → pestaña Backups → activar. Hoy no hay
ninguno, y ya hay datos reales de cuentas y consultas.

## Paso 5 · Resend: verificar el dominio `[te toca a ti]`

Confirmado por DNS que **no está verificado**: `regulamed.cl` no tiene registro
SPF ni `resend._domainkey`. La API key que hay es de solo-envío, así que no se
puede consultar el estado desde acá.

1. Resend → Domains → Add Domain → `regulamed.cl`.
2. Copia los registros que te dé (SPF `TXT`, DKIM `resend._domainkey`, y el
   `MX` de bounces) a tu DNS.
3. Cuando Resend lo marque verificado, en Railway pon `AUTH_MAGIC_LINK=1`.
   Hasta entonces los correos salen desde `onboarding@resend.dev` y caen a spam
   — por eso el enlace mágico está apagado (se ve en `/ingresar`, que renderiza
   con `magicLink: false`).

## Paso 6 · `CRON_SECRET` para el resumen semanal `[te toca a ti]`

El repo **no tiene ningún secret ni variable definida** todavía.

1. Genera uno: `openssl rand -base64 32`
2. Ponlo en Railway como `CRON_SECRET`.
3. Ponlo también en GitHub → Settings → Secrets and variables → Actions →
   **Secrets** → `CRON_SECRET` (el workflow `resumen-semanal.yml` lo espera ahí;
   corre los lunes a las 12:00 UTC).
4. Define además la variable `REGULAMED_URL` si el dominio todavía no apunta a
   Railway; ese workflow usa `vars.REGULAMED_URL || 'https://regulamed.cl'`.

Mientras tanto, el resumen se genera entrando a `/api/cron/resumen-semanal` con
tu sesión de administrador.

## Paso 7 · Agenda: segundo cliente OAuth `[te toca a ti]`

Confirmado que está apagada: `/api/agenda/huecos` responde
`{"disponible":false,"motivo":"agenda_sin_configurar"}`.

1. Google Cloud → **otro** ID de cliente OAuth (aplicación web), distinto del
   login. Scopes `calendar.events` y `calendar.readonly`. URI de redirección:
   `http://localhost:5858/callback`.
2. **Publica la app en producción** (no la dejes en modo prueba: ahí el refresh
   token caduca a los 7 días y la agenda se apaga sola).
3. Pon `GOOGLE_CAL_CLIENT_ID` y `GOOGLE_CAL_CLIENT_SECRET` en
   `APP-Regulatoria/web/.env.local` (ya están con el nombre correcto) y corre:
   ```
   cd APP-Regulatoria/web
   node --env-file=.env.local scripts/google-auth.mjs
   ```
   > El script **no** carga `.env.local` solo; sin `--env-file` aborta diciendo
   > que faltan las variables.
4. El refresh token que imprime va a Railway como `GOOGLE_REFRESH_TOKEN`, junto
   con las otras dos.
5. Ajusta el horario en `/admin/agenda` (la pantalla existe). Por defecto:
   lunes a viernes 19:00–22:00, 30 min, buffer 15, antelación 24 h, horizonte
   21 días, calendario `primary`.

## Paso 8 · IA: cuenta en Groq `[te toca a ti]`

1. Crea la cuenta y pon `LLM_API_KEY` en Railway. `LLM_BASE_URL` y `LLM_MODEL`
   ya tienen valor por defecto (Groq con `openai/gpt-oss-120b`).
2. **Antes de encenderla para todos**, corre `node scripts/eval-ia.mjs`: exige
   90% de citas correctas y cero citas incorrectas.
3. Sin `LLM_API_KEY` el botón no aparece y el buscador funciona igual, así que
   no hay apuro.

## Paso 9 · Ejecutor del corpus `[RESUELTO]`

**El corpus ya se mantiene solo en la nube.** No hace falta que hagas nada, y
el runner self-hosted quedó sin motivo.

Corrida verde del 2026-09-08 en un runner GitHub-hosted: **121 documentos,
2 584 chunks, recall@5 16/16 = 100%, abstención 5/5 = 100%** — las mismas
cifras que producía el PC. Se publicó sola, Railway la desplegó, y
`/api/estado` ahora responde `"publicado_por": "github-actions"` en vez de
`"pc-local"`.

Hizo falta un cuarto arreglo además de los tres de la sección 4: los 31 PDF de
`ANAMED_Normativa/otros/` (116 MB) no están en el listado del ISP, así que el
paso de reconciliación no puede bajarlos y el corpus salía incompleto fuera de
tu PC. Ahora van en el repo por **Git LFS**, con el mismo criterio por el que
ya se versionaban los sidecars OCR: un documento irrecuperable no puede vivir
en un solo disco.

`checkout` se dejó **sin** `lfs: true` a propósito: 116 MB por corrida diaria
revientan la cuota gratuita de 1 GB de ancho de banda LFS en una semana. Un
paso posterior al caché materializa los punteros solo cuando el caché no los
trajo, y **aborta si queda alguno sin materializar** en vez de armar un corpus
mutilado en silencio — que es exactamente el modo de falla del 7 de septiembre.

Lo que sí te queda por hacer, cuando quieras:

- **Apagar la tarea del Programador de tareas de Windows.** Ya no hace falta y
  compite por el mismo commit. Puede quedar como respaldo silencioso si le
  cambias la hora a después de las 08:00 Chile.
- `corpus-diario-local.yml` **fue eliminado**: tenía el mismo cron que el
  workflow de la nube y los dos habrían competido si registrabas el runner. Se
  recupera con `git revert ee21fd1` si alguna vez hiciera falta.

---

## Riesgo conocido que conviene no olvidar

`drizzle/meta/_journal.json` solo conoce la migración `0000`. Las `0001`–`0003`
se escribieron a mano y el aplicador (`scripts/migrate.mjs`) las lee
directamente de disco, así que **funcionan**; pero si algún día corres
`drizzle-kit generate`, va a creer que las tablas `feedback`, `agenda_config` y
`reservas` no existen y va a proponer crearlas de nuevo. Regenera los snapshots
de `drizzle/meta` antes de volver a usar esa herramienta.
