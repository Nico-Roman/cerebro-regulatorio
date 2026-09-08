# Supuestos y pendientes de la noche del 8 de septiembre de 2026

Trabajo hecho mientras dormías, con la instrucción de no pausar y anotar cada
decisión asumida. Esto es la lista para tu visto bueno. Está ordenada por lo que
te toca decidir o desbloquear, no por cuándo lo hice.

## 1 · Lo que quedó vivo en producción

- **El deploy estaba roto desde el 7 de septiembre y nadie lo sabía.** Railway
  seguía sirviendo el build `50d0d29` (sin auth, sin `/api/estado`) porque desde
  `0387610` el `Dockerfile` dejó de estar en la raíz del repo. Cambié el **Root
  Directory** del servicio a `APP-Regulatoria/web`.
- **`DATABASE_URL` estaba vacía.** Apuntaba a `${{Postgres.DATABASE_PRIVATE_URL}}`
  y el servicio Postgres de este proyecto no expone esa variable, así que
  resolvía a cadena vacía y el contenedor moría en bucle (`[migrate]
  DATABASE_URL no está configurada`). La cambié a `${{Postgres.DATABASE_URL}}`.
  **Revisa** que el host que resuelve sea `postgres.railway.internal` (red
  privada) y no el proxy público.
- Con eso, la **Fase 2 quedó viva**: `/normativa` exige cuenta, `/api/estado`
  responde con el corpus del 7 de septiembre, y las migraciones corrieron.

## 2 · Decisiones que tomé por ti (necesito tu visto bueno)

### Infraestructura
1. **Desplegué la Fase 2 sabiendo que dejaba el buscador cerrado.** Lo
   conversamos: sin `GOOGLE_CLIENT_ID`/`SECRET` nadie puede entrar, ni tú. Es lo
   primero de la lista de pendientes.
2. **Migraciones `0001`, `0002` y `0003` escritas a mano**, no con
   `drizzle-kit generate`: la sesión no tenía red ni base para introspectar. El
   aplicador (`scripts/migrate.mjs`) solo lee los `.sql` en orden, así que
   funcionan igual. **Consecuencia:** si vuelves a usar `drizzle-kit generate`,
   regenera antes los snapshots de `drizzle/meta`.

### Fase 3 · Panel
3. **"Lead caliente" = 3 o más consultas en 7 días, o perfil
   importador/empresa/consultor.** Es un corte, no un puntaje: separa a quien
   probó el buscador de quien lo usa para trabajar.
4. **Un voto de feedback por consulta**, y solo el autor puede votar. Votar de
   nuevo corrige, no duplica.
5. **CSV con `;` y BOM** (Excel en Windows abre los acentos bien).
6. **El resumen semanal necesita `CRON_SECRET`** para automatizarse. Mientras no
   exista, puedes generarlo entrando a `/api/cron/resumen-semanal` con tu sesión
   de administrador.

### Fase 4 · Agenda
7. **Horario por defecto: lunes a viernes, 19:00–22:00**, 30 minutos, buffer 15,
   antelación mínima 24 h, horizonte 21 días, calendario `primary`. Está en la
   tabla `agenda_config`, editable con SQL sin desplegar. **Todavía no hay
   pantalla en `/admin` para editarlo** — quedó pendiente.
8. **Google Calendar por HTTP directo, sin el paquete `googleapis`.** Son tres
   llamadas y el paquete pesa decenas de megas en la imagen.
9. **Reprogramar = cancelar y volver a agendar.** No hay reprogramación en un
   paso; el enlace del correo cancela y ofrece agendar de nuevo.
10. **El recordatorio de 24 h lo manda Google Calendar** (recordatorio por correo
    24 h antes + popup 30 min), no un cron nuestro. Menos piezas que puedan
    fallar en silencio.
11. **Tope de 5 reservas por hora y por IP**, más una trampa anti-bots invisible.

### Fase 5 · IA
12. **Proveedor por HTTP compatible con OpenAI, no el Vercel AI SDK.** Cambiar de
    proveedor son dos variables (`LLM_BASE_URL`, `LLM_MODEL`); no agrega
    dependencias. Por defecto **Groq con `openai/gpt-oss-120b`**.
13. **Sin streaming todavía** (el plan lo pedía). La respuesta llega completa.
    Es la desviación más visible; se puede agregar después sin tocar el prompt.
14. **Cuota: 20 respuestas redactadas por día y por persona**; 6 pasajes al
    modelo; 700 tokens de salida; temperatura 0.
15. **La respuesta ya redactada se guarda y se reutiliza** en vez de volver a
    llamar al modelo.
16. **La compuerta de confianza manda:** si el motor declaró ausencia, no se
    llama al modelo.
17. **No se enciende sola:** sin `LLM_API_KEY` el botón no aparece. Y antes de
    encenderla para todos, corre `scripts/eval-ia.mjs` (exige 90% de citas
    correctas y cero citas incorrectas).

## 3 · Lo que no pude hacer yo (necesita tus credenciales)

En orden de impacto:

1. **Google OAuth del login.** Google Cloud → Credenciales → ID de cliente OAuth
   (aplicación web). URIs de redirección:
   `https://regulamed.cl/api/auth/callback/google` y
   `http://localhost:3000/api/auth/callback/google`. Luego, en Railway:
   `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. **Hasta esto, el buscador está
   cerrado para todos.**
2. **Verificar regulamed.cl en Resend** (SPF/DKIM en el DNS). Habilita el enlace
   mágico (`AUTH_MAGIC_LINK=1`) y el remitente propio en vez de
   `onboarding@resend.dev`.
3. **Agenda:** segundo cliente OAuth ("agenda interna", scopes
   `calendar.events` + `calendar.readonly`, redirección
   `http://localhost:5858/callback`), **publicar la app en producción** (en modo
   prueba el refresh token caduca a los 7 días), y correr
   `node scripts/google-auth.mjs`. El token va a Railway como
   `GOOGLE_REFRESH_TOKEN`, junto con `GOOGLE_CAL_CLIENT_ID` y
   `GOOGLE_CAL_CLIENT_SECRET`.
4. **IA:** crear la cuenta en Groq y poner `LLM_API_KEY` en Railway.
5. **`CRON_SECRET`** en Railway y como secret en GitHub, para el resumen semanal.
6. **Monitor externo** (UptimeRobot o Better Stack) sobre
   `https://regulamed.cl/api/estado`, cada 5 minutos.
7. **Backups de Postgres** en Railway (pestaña Backups del servicio).
8. **DNS:** confirmar que regulamed.cl apunta a Railway y dejar Vercel con el 301.

## 4 · Detalles menores que conviene que sepas

- El repo tiene un archivo `APP-Regulatoria/web-src-claude.tgz` que usé para
  compilar en un contenedor con red (aquí no se puede: el VM montado no alcanza
  ni npm ni Google Fonts). Está en `.gitignore`; **puedes borrarlo**.
- El `.git` de la carpeta montada quedó con locks que el VM no puede borrar
  (`index.lock`, `refs/heads/main.lock`, objetos `tmp_obj_*`). No afectan a
  Windows, pero conviene correr `git gc --prune=now` desde tu PC.
- Cada commit se verificó con `tsc --noEmit` y un `next build` completo en el
  contenedor (con las fuentes stubbeadas, porque ese entorno no alcanza Google
  Fonts). Ninguno se probó contra una base de datos real: eso lo confirma el
  primer arranque en Railway.
