# Plan: RegulaMED en Railway

> Generado el 3 sep 2026 con Claude a partir del código en `APP-Regulatoria/web` y el PRD. Fuente de verdad para las sesiones de Claude Code que implementen la migración. Fases 0→6 en orden; cada una deja algo en producción. Versión web: artifact "RegulaMED en Railway" en claude.ai.

## Resumen

Pasar cerebro-regulatorio.vercel.app a Railway bajo regulamed.cl, poner el buscador detrás de un registro con Google o correo, guardar cada pregunta ligada a la persona que la hizo, y sumar una página de agenda que lee tu Google Calendar. Con una capa de IA diseñada para costar centavos, no dólares.

Fecha **3 sep 2026** Repo **Nico-Roman/cerebro-regulatorio** (carpeta `APP-Regulatoria/web`) Stack objetivo **Next.js 16 · Postgres · Better Auth · Railway**

## 00 · Decisiones ya tomadas

Esto es lo que acordamos en las preguntas previas. Todo lo demás del plan se deriva de acá.

Registro  
Google + enlace mágico por correo (sin contraseñas). Home y servicios públicos; el buscador exige cuenta.

Auth + DB  
Postgres en Railway + Better Auth dentro del Next.js. Tú eres dueño de las tablas.

Leads  
Postgres como fuente de verdad + panel `/admin` propio con exportación CSV. Klaviyo/n8n quedan como sincronización opcional.

Agenda  
Ruta `/agenda` en la misma web. 30 min, lunes a viernes, solo huecos reales de tu Google Calendar, buffer 15 min, crea evento con Google Meet.

Dominio  
regulamed.cl apunta a Railway; el sitio de Vercel queda redirigiendo.

IA  
Fase posterior, con proveedor intercambiable. Prioridad: barato o gratis sin sacrificar calidad en español ni privacidad de las consultas.

Corpus  
La actualización diaria sigue en tu PC; cada commit redeploya en Railway solo si cambió el corpus.

Paso 0 · antes de cualquier otra cosa

El remote de git en `APP-Regulatoria/web` tiene un token personal de GitHub (`ghp_…`) escrito dentro de la URL. Ese token da acceso de escritura a tu repo y queda visible en `.git/config`, en logs y en cualquier respaldo de la carpeta. Revócalo hoy en GitHub → Settings → Developer settings → Personal access tokens, y reconfigura el remote con SSH o con `gh auth login`. También rota `RESEND_API_KEY` si alguna vez estuvo en un archivo compartido.

## 01 · Lo que hay hoy

Leí el código en tu carpeta. El inventario importa porque define qué se migra tal cual y qué se rediseña.

| Pieza                 | Estado actual                                                                                                                                                             | Qué pasa con ella                                                                                          |
|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| Web                   | Next.js 16.3 + React 19 + Tailwind 4, App Router. Home, `/normativa`, 5 rutas API.                                                                                        | Se migra 1:1 en la Fase 1. Después se le agrega auth y DB.                                                 |
| Motor de búsqueda     | BM25 híbrido en TypeScript (`lib/search.ts`), corpus de 5,7 MB (`data/corpus.jsonl`) cargado en memoria del servidor. Devuelve pasajes con cita y una señal de confianza. | No se toca. Corre igual en Railway (proceso Node persistente, que de hecho le viene mejor que serverless). |
| Registro de preguntas | Webhook a n8n → Google Sheets, sin saber quién preguntó.                                                                                                                  | Reemplazado por inserción en Postgres con `user_id`. El webhook queda opcional.                            |
| Contacto              | Formulario → Resend (`RESEND_API_KEY`). Honeypot anti-bots.                                                                                                               | Se mantiene. Resend también enviará los enlaces mágicos y las confirmaciones de agenda.                    |
| Usuarios / DB         | No existen.                                                                                                                                                               | Fase 2.                                                                                                    |
| Corpus                | `cerebro/` en Python genera el corpus; `actualizar-diario.js` lo copia y hace commit diario desde tu PC.                                                                  | Sigue igual. Se configura Railway para redeployar solo si cambia `data/` o código.                         |
| Dominio               | `SITE.url` apunta a cerebro-regulatorio.vercel.app; el correo ya es @regulamed.cl.                                                                                        | Pasa a https://regulamed.cl en la Fase 1.                                                                  |

## 02 · Arquitectura objetivo

Un solo servicio Next.js en Railway hace de front y de backend, con Postgres al lado en red privada. No hay razón para separar front y API en dos deploys a esta escala; la protección viene de que *ninguna* ruta de datos responde sin sesión válida y de que el corpus y las llaves nunca salen del servidor.

![](data:image/svg+xml;base64,PHN2ZyB2aWV3Ym94PSIwIDAgNzYwIDQwMCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJEaWFncmFtYTogbmF2ZWdhZG9yIOKGkiBSYWlsd2F5IChOZXh0LmpzICsgUG9zdGdyZXMpIOKGkiBzZXJ2aWNpb3MgZXh0ZXJub3MiPgogICAgICA8ZGVmcz48bWFya2VyIGlkPSJhcnIiIHZpZXdib3g9IjAgMCAxMCAxMCIgcmVmeD0iOSIgcmVmeT0iNSIgbWFya2Vyd2lkdGg9IjciIG1hcmtlcmhlaWdodD0iNyIgb3JpZW50PSJhdXRvLXN0YXJ0LXJldmVyc2UiPjxwYXRoIGQ9Ik0wIDAgTDEwIDUgTDAgMTAgeiIgZmlsbD0idmFyKC0tbXV0ZWQpIj48L3BhdGg+PC9tYXJrZXI+PC9kZWZzPgogICAgICA8c3R5bGU+CiAgICAgICAgLmJveHtmaWxsOnZhcigtLXBhcGVyKTtzdHJva2U6dmFyKC0tbGluZSk7c3Ryb2tlLXdpZHRoOjF9CiAgICAgICAgLmJveC5tYWlue2ZpbGw6dmFyKC0tYWNjZW50LXNvZnQpO3N0cm9rZTp2YXIoLS1hY2NlbnQpfQogICAgICAgIC50e2ZvbnQtZmFtaWx5OnZhcigtLWZvbnQtYm9keSk7Zm9udC1zaXplOjEzcHg7ZmlsbDp2YXIoLS1pbmspfQogICAgICAgIC5ze2ZvbnQtZmFtaWx5OnZhcigtLWZvbnQtbW9ubyk7Zm9udC1zaXplOjExcHg7ZmlsbDp2YXIoLS1tdXRlZCl9CiAgICAgICAgLmx7c3Ryb2tlOnZhcigtLW11dGVkKTtzdHJva2Utd2lkdGg6MS4yO2ZpbGw6bm9uZTttYXJrZXItZW5kOnVybCgjYXJyKX0KICAgICAgICAuZ3Jwe2ZpbGw6bm9uZTtzdHJva2U6dmFyKC0tbGluZSk7c3Ryb2tlLWRhc2hhcnJheTo0IDR9CiAgICAgIDwvc3R5bGU+CiAgICAgIDwhLS0gYnJvd3NlciAtLT4KICAgICAgPHJlY3QgY2xhc3M9ImJveCIgeD0iMjAiIHk9IjE1MCIgd2lkdGg9IjE1MCIgaGVpZ2h0PSI5MCIgcng9IjYiPjwvcmVjdD4KICAgICAgPHRleHQgY2xhc3M9InQiIHg9Ijk1IiB5PSIxODUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5hdmVnYWRvcjwvdGV4dD4KICAgICAgPHRleHQgY2xhc3M9InMiIHg9Ijk1IiB5PSIyMDUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPnJlZ3VsYW1lZC5jbDwvdGV4dD4KICAgICAgPHRleHQgY2xhc3M9InMiIHg9Ijk1IiB5PSIyMjIiIHRleHQtYW5jaG9yPSJtaWRkbGUiPmNvb2tpZSBkZSBzZXNpw7NuPC90ZXh0PgogICAgICA8IS0tIHJhaWx3YXkgZ3JvdXAgLS0+CiAgICAgIDxyZWN0IGNsYXNzPSJncnAiIHg9IjIyMCIgeT0iNDAiIHdpZHRoPSIzMDAiIGhlaWdodD0iMzIwIiByeD0iMTAiPjwvcmVjdD4KICAgICAgPHRleHQgY2xhc3M9InMiIHg9IjIzNSIgeT0iNjIiPlJBSUxXQVkgwrcgcHJveWVjdG8gcmVndWxhbWVkPC90ZXh0PgogICAgICA8cmVjdCBjbGFzcz0iYm94IG1haW4iIHg9IjI0NSIgeT0iODUiIHdpZHRoPSIyNTAiIGhlaWdodD0iMTQwIiByeD0iNiI+PC9yZWN0PgogICAgICA8dGV4dCBjbGFzcz0idCIgeD0iMzcwIiB5PSIxMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtd2VpZ2h0PSI2MDAiPk5leHQuanMgMTYgKHVuIHNlcnZpY2lvKTwvdGV4dD4KICAgICAgPHRleHQgY2xhc3M9InMiIHg9IjI2MCIgeT0iMTM1Ij4vIC9ub3JtYXRpdmEgL2FnZW5kYSAvYWRtaW48L3RleHQ+CiAgICAgIDx0ZXh0IGNsYXNzPSJzIiB4PSIyNjAiIHk9IjE1MyI+L2FwaS9zZWFyY2ggIOKGkCByZXF1aWVyZSBzZXNpw7NuPC90ZXh0PgogICAgICA8dGV4dCBjbGFzcz0icyIgeD0iMjYwIiB5PSIxNzEiPi9hcGkvYXV0aC8qICBCZXR0ZXIgQXV0aDwvdGV4dD4KICAgICAgPHRleHQgY2xhc3M9InMiIHg9IjI2MCIgeT0iMTg5Ij4vYXBpL2FnZW5kYS8qIC9hcGkvY29udGFjdG88L3RleHQ+CiAgICAgIDx0ZXh0IGNsYXNzPSJzIiB4PSIyNjAiIHk9IjIwNyI+Y29ycHVzIEJNMjUgZW4gbWVtb3JpYTwvdGV4dD4KICAgICAgPHJlY3QgY2xhc3M9ImJveCIgeD0iMjQ1IiB5PSIyNTUiIHdpZHRoPSIyNTAiIGhlaWdodD0iODAiIHJ4PSI2Ij48L3JlY3Q+CiAgICAgIDx0ZXh0IGNsYXNzPSJ0IiB4PSIzNzAiIHk9IjI4MiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9IjYwMCI+UG9zdGdyZXM8L3RleHQ+CiAgICAgIDx0ZXh0IGNsYXNzPSJzIiB4PSIzNzAiIHk9IjMwMiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+dXNlciDCtyBzZXNzaW9uIMK3IHBlcmZpbCDCtyBjb25zdWx0YXM8L3RleHQ+CiAgICAgIDx0ZXh0IGNsYXNzPSJzIiB4PSIzNzAiIHk9IjMxOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+cmVzZXJ2YXMgwrcgcmVkIHByaXZhZGEsIGJhY2t1cHM8L3RleHQ+CiAgICAgIDxwYXRoIGNsYXNzPSJsIiBkPSJNMzcwIDIyNSBWMjU1Ij48L3BhdGg+CiAgICAgIDwhLS0gZXh0ZXJuYWwgLS0+CiAgICAgIDxyZWN0IGNsYXNzPSJib3giIHg9IjU4MCIgeT0iNjAiIHdpZHRoPSIxNjAiIGhlaWdodD0iNTIiIHJ4PSI2Ij48L3JlY3Q+CiAgICAgIDx0ZXh0IGNsYXNzPSJ0IiB4PSI2NjAiIHk9IjgyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Hb29nbGUgT0F1dGg8L3RleHQ+CiAgICAgIDx0ZXh0IGNsYXNzPSJzIiB4PSI2NjAiIHk9Ijk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5sb2dpbiB1c3VhcmlvczwvdGV4dD4KICAgICAgPHJlY3QgY2xhc3M9ImJveCIgeD0iNTgwIiB5PSIxMjgiIHdpZHRoPSIxNjAiIGhlaWdodD0iNTIiIHJ4PSI2Ij48L3JlY3Q+CiAgICAgIDx0ZXh0IGNsYXNzPSJ0IiB4PSI2NjAiIHk9IjE1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+R29vZ2xlIENhbGVuZGFyPC90ZXh0PgogICAgICA8dGV4dCBjbGFzcz0icyIgeD0iNjYwIiB5PSIxNjciIHRleHQtYW5jaG9yPSJtaWRkbGUiPmZyZWVidXN5IMK3IE1lZXQgwrcgdHUgY3VlbnRhPC90ZXh0PgogICAgICA8cmVjdCBjbGFzcz0iYm94IiB4PSI1ODAiIHk9IjE5NiIgd2lkdGg9IjE2MCIgaGVpZ2h0PSI1MiIgcng9IjYiPjwvcmVjdD4KICAgICAgPHRleHQgY2xhc3M9InQiIHg9IjY2MCIgeT0iMjE4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5SZXNlbmQ8L3RleHQ+CiAgICAgIDx0ZXh0IGNsYXNzPSJzIiB4PSI2NjAiIHk9IjIzNSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+bWFnaWMgbGluayDCtyBjb250YWN0byDCtyBjaXRhczwvdGV4dD4KICAgICAgPHJlY3QgY2xhc3M9ImJveCIgeD0iNTgwIiB5PSIyNjQiIHdpZHRoPSIxNjAiIGhlaWdodD0iNTIiIHJ4PSI2Ij48L3JlY3Q+CiAgICAgIDx0ZXh0IGNsYXNzPSJ0IiB4PSI2NjAiIHk9IjI4NiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UHJvdmVlZG9yIElBPC90ZXh0PgogICAgICA8dGV4dCBjbGFzcz0icyIgeD0iNjYwIiB5PSIzMDMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkZhc2UgNSDCtyBpbnRlcmNhbWJpYWJsZTwvdGV4dD4KICAgICAgPHJlY3QgY2xhc3M9ImJveCIgeD0iNTgwIiB5PSIzMzIiIHdpZHRoPSIxNjAiIGhlaWdodD0iNTIiIHJ4PSI2Ij48L3JlY3Q+CiAgICAgIDx0ZXh0IGNsYXNzPSJ0IiB4PSI2NjAiIHk9IjM1NCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+bjhuIC8gS2xhdml5bzwvdGV4dD4KICAgICAgPHRleHQgY2xhc3M9InMiIHg9IjY2MCIgeT0iMzcxIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5vcGNpb25hbCDCtyBzeW5jIGRlIGxlYWRzPC90ZXh0PgogICAgICA8IS0tIGFycm93cyAtLT4KICAgICAgPHBhdGggY2xhc3M9ImwiIGQ9Ik0xNzAgMTk1IEgyNDUiPjwvcGF0aD4KICAgICAgPHBhdGggY2xhc3M9ImwiIGQ9Ik00OTUgMTA1IEg1ODAiPjwvcGF0aD4KICAgICAgPHBhdGggY2xhc3M9ImwiIGQ9Ik00OTUgMTUwIEg1ODAiPjwvcGF0aD4KICAgICAgPHBhdGggY2xhc3M9ImwiIGQ9Ik00OTUgMjAwIEg1ODAiPjwvcGF0aD4KICAgICAgPHBhdGggY2xhc3M9ImwiIGQ9Ik00OTUgMjIwIEM1NDAgMjIwIDU0MCAyOTAgNTgwIDI5MCI+PC9wYXRoPgogICAgICA8cGF0aCBjbGFzcz0ibCIgZD0iTTQ5NSAzMDAgQzU0MCAzMDAgNTQwIDM1OCA1ODAgMzU4Ij48L3BhdGg+CiAgICAgIDwhLS0gcGMgLS0+CiAgICAgIDxyZWN0IGNsYXNzPSJib3giIHg9IjIwIiB5PSIyOTAiIHdpZHRoPSIxNTAiIGhlaWdodD0iNzAiIHJ4PSI2Ij48L3JlY3Q+CiAgICAgIDx0ZXh0IGNsYXNzPSJ0IiB4PSI5NSIgeT0iMzE4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5UdSBQQzwvdGV4dD4KICAgICAgPHRleHQgY2xhc3M9InMiIHg9Ijk1IiB5PSIzMzYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPmFjdHVhbGl6YXItZGlhcmlvLmpzPC90ZXh0PgogICAgICA8dGV4dCBjbGFzcz0icyIgeD0iOTUiIHk9IjM1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Z2l0IHB1c2gg4oaSIHJlZGVwbG95PC90ZXh0PgogICAgICA8cGF0aCBjbGFzcz0ibCIgZD0iTTE3MCAzMjUgQzIwMCAzMjUgMjAwIDM0NSAyMjAgMzQ1Ij48L3BhdGg+CiAgICA8L3N2Zz4=)

Todo lo que tiene llave o datos vive dentro del recuadro de Railway. El navegador solo ve HTML y una cookie.

Piezas concretas del stack, todas en el mismo repo:

- **Better Auth** con proveedor Google y plugin `magicLink`; adaptador Drizzle sobre Postgres. Genera sus 4 tablas y maneja cookies httpOnly, CSRF y expiración.
- **Drizzle ORM** para las tablas propias (perfil, consultas, reservas) y migraciones versionadas en el repo.
- **`proxy.ts`** de Next 16 (lo que antes era middleware) para redirigir a `/ingresar` cualquier ruta protegida sin sesión, más verificación real de sesión dentro de cada route handler (la redirección sola no protege la API).
- **Rate limit** por usuario y por IP en `/api/search` y en las rutas de auth, con un contador en Postgres (sin Redis extra).
- **googleapis** solo del lado servidor para freebusy y creación de eventos con tu refresh token.

## 03 · Fases de trabajo

Ordenadas para que cada fase deje algo en producción y nada dependa de una fase que todavía no existe. Los tiempos asumen sesiones de trabajo con Claude Code en las tardes, no jornadas completas.

### Fase 0 · Higiene de seguridad

Hoy · 30 min

Cerrar la fuga antes de exponer nada nuevo.

1.  Revocar el token `ghp_…` en GitHub y reconfigurar el remote: `git remote set-url origin git@github.com:Nico-Roman/cerebro-regulatorio.git` (o `gh auth login` y URL https limpia).
2.  Confirmar que `.env*` nunca se commiteó: `git log --all --diff-filter=A --name-only | grep -i env`.
3.  Rotar `RESEND_API_KEY` si hay duda. Anotar todas las variables actuales de Vercel (Settings → Environment Variables) para replicarlas.
4.  Activar 2FA en GitHub y Railway.

**Listo cuando** `git remote -v` no muestra ningún token y el push sigue funcionando.

### Fase 1 · Migración 1:1 a Railway y dominio

Semana 1 · 2-3 sesiones

La misma web de hoy, sirviéndose desde regulamed.cl, sin depender de Vercel.

1.  Crear proyecto Railway `regulamed` (plan Hobby, US\$5/mes con US\$5 de uso incluidos). Servicio desde el repo GitHub, rama `main`.
2.  Añadir `output: "standalone"` en `next.config.ts` y un `Dockerfile` multi-stage (node 22-alpine) que copie `data/corpus.jsonl`. Railway detecta Next.js sin Dockerfile, pero el Dockerfile fija versión de Node y hace el build reproducible.
3.  Reemplazar `after()` de `next/server` por un `void fetch(...)` con timeout: `after()` es útil en serverless; en un proceso persistente basta no esperar la promesa. Menor, pero evita sorpresas.
4.  Ruta `/api/health` que responda 200 solo cuando el corpus está cargado; configurarla como healthcheck en Railway para deploys sin caída.
5.  Variables: `RESEND_API_KEY`, `CONTACTO_FROM`, `CONTACTO_TO`, `CEREBRO_LOG_WEBHOOK`, `NEXT_PUBLIC_SITE_URL=https://regulamed.cl`.
6.  Watch paths en Railway: `app/**, components/**, lib/**, data/**, package*.json, next.config.ts, Dockerfile`, para que el commit diario del corpus redeploye solo si el archivo realmente cambió (los commits "+0/~0/-0" no gatillan nada).
7.  Probar en la URL `*.up.railway.app`: búsqueda, filtros, contacto, sitemap.
8.  Dominio: en Railway agregar `regulamed.cl` y `www.regulamed.cl`; en el DNS crear los CNAME que Railway indique (para el apex, ALIAS/ANAME o los registros que tu proveedor DNS soporte). SSL automático.
9.  Cambiar `SITE.url` a regulamed.cl; `robots.ts` y `sitemap.ts` lo leen de ahí.
10. En Vercel: dejar el proyecto con una única redirección 301 de todo a `https://regulamed.cl/:path*` (en `vercel.json`) y no borrarlo por 90 días. Registrar regulamed.cl en Google Search Console y usar "cambio de dirección".

**Listo cuando** regulamed.cl sirve la web con candado, el formulario de contacto llega, y cerebro-regulatorio.vercel.app redirige.

### Fase 2 · Postgres, registro y buscador protegido

Semana 2 · 3-4 sesiones

Nadie busca sin cuenta; cada pregunta queda ligada a una persona.

1.  Añadir Postgres en el mismo proyecto Railway. Usar la URL de red privada (`DATABASE_URL` interna) desde la app.
2.  Instalar `better-auth`, `drizzle-orm`, `drizzle-kit`, `pg`. Generar esquema de Better Auth + tablas propias (sección 04). Migraciones con `drizzle-kit migrate` en el comando de inicio del contenedor.
3.  Google Cloud: proyecto "RegulaMED", pantalla de consentimiento externa, cliente OAuth web con redirect `https://regulamed.cl/api/auth/callback/google` (y el de localhost). Scopes básicos (email, profile): no requiere verificación de Google.
4.  Magic link por Resend desde `acceso@regulamed.cl`: exige verificar el dominio en Resend (registros SPF/DKIM en el DNS). Sin eso los correos caen a spam.
5.  Pantalla `/ingresar`: botón Google + campo de correo. Tras el primer login, paso obligatorio de perfil: nombre, empresa, cargo, tipo de perfil (QF regulatorio / QA / consultor / importador / estudiante / otro), teléfono opcional, checkbox de aceptación de privacidad y otro, separado, de "quiero recibir novedades regulatorias".
6.  Proteger: `proxy.ts` redirige `/normativa` y `/admin` sin sesión; `/api/search` devuelve 401 sin sesión (verificación con `auth.api.getSession`, no solo la redirección).
7.  `/api/search` inserta en `consultas` (misma información que hoy va a Sheets, más `user_id`). Mantener el webhook n8n solo si `CEREBRO_LOG_WEBHOOK` está definida.
8.  Rate limit: 60 búsquedas/hora por usuario, 10 intentos de login/hora por IP.
9.  Home: reemplazar el buscador abierto por un buscador que al enviar lleva a `/ingresar?next=/normativa?q=…`, para no perder la pregunta que la persona ya escribió. Es el mejor gancho de registro que tienes.

**Listo cuando** un usuario nuevo entra con Google, completa perfil, busca, y la fila aparece en `consultas` con su `user_id`; un `curl` a `/api/search` sin cookie recibe 401.

### Fase 3 · Panel de leads y retroalimentación

Semana 3 · 2 sesiones

Ver quién usa el cerebro, qué pregunta y qué le falta al corpus.

1.  `/admin` visible solo para `ADMIN_EMAILS`. Vistas: usuarios (con nº de consultas, última actividad, empresa, perfil), consultas (filtrables por confianza y fecha), y "fuera del corpus" (ranking de `conceptos_fuera_del_corpus`, que ya calcula tu motor).
2.  Exportar CSV de usuarios y consultas. Filtro "leads calientes": ≥3 consultas en 7 días o perfil empresa/importador.
3.  Feedback en cada resultado (¿te sirvió? sí/no + comentario) → tabla `feedback`. Esto es la retroalimentación real: preguntas sin cobertura + votos negativos alimentan `preguntas-fuera-corpus.json` y tu lista de normas a incorporar.
4.  Correo semanal automático a ti (Resend, cron de Railway) con nuevos registros, top preguntas y huecos del corpus.
5.  Opcional: webhook por registro nuevo a n8n para crear perfil en Klaviyo o fila en Notion. Un solo POST; el resto lo arma n8n.

**Listo cuando** puedes descargar la lista de leads con sus preguntas y ves el ranking de conceptos que el corpus no cubre.

### Fase 4 · Agenda `/agenda`

Semana 3-4 · 2-3 sesiones

Alguien elige un hueco libre real y aparece en tu Google Calendar con Meet.

1.  En el mismo proyecto Google Cloud, habilitar Calendar API y crear un segundo cliente OAuth ("agenda interna"). Scope `calendar.events` + `calendar.freebusy`. Publicar la app en "producción" aunque no esté verificada: en modo "testing" los refresh tokens caducan a los 7 días y la agenda se rompería cada semana.
2.  Script único `scripts/google-auth.ts` que abre el consentimiento con tu cuenta y guarda el `GOOGLE_REFRESH_TOKEN` en Railway. Nadie más autoriza nada: es tu calendario.
3.  Configuración en tabla `agenda_config` (editable desde `/admin`): duración 30 min, buffer 15, ventana lun-vie con hora inicio/fin que defines, zona America/Santiago, antelación mínima 24 h, horizonte 21 días, lista de IDs de calendarios a considerar (trabajo, diplomado, Inacap, personal).
4.  `GET /api/agenda/huecos?dia=`: freebusy sobre todos tus calendarios → resta ocupados y buffers → devuelve slots. Se cachea 60 s.
5.  `POST /api/agenda/reservar`: revalida el hueco (evita doble reserva), crea evento con `conferenceData` (Meet), invitado como asistente, guarda en `reservas`, envía confirmación por Resend con el link y un `.ics`. Recordatorio 24 h antes vía cron.
6.  UI: calendario mensual → lista de horas → formulario (nombre, correo, empresa, motivo). Si la persona ya está logueada, se pre-llena y la reserva queda ligada a su `user_id` (lead que pidió llamada = el más caliente de todos).
7.  Cancelación y reprogramación con un enlace firmado en el correo.

**Listo cuando** reservas desde un navegador anónimo, el evento aparece en tu calendario con Meet, recibes ambos el correo y el hueco desaparece de la página.

### Fase 5 · Capa de IA (respuesta redactada con citas)

Después · 2-3 sesiones

Convertir los pasajes que ya recupera BM25 en una respuesta corta, en español, que cite artículo y norma y diga "no está en el corpus" cuando corresponde.

1.  Usar el **Vercel AI SDK** (funciona fuera de Vercel) como capa de abstracción: cambiar de proveedor es cambiar `LLM_PROVIDER` y `LLM_MODEL`, no código.
2.  Prompt fijo con reglas: responder solo con los pasajes entregados, citar `[cita]` de cada afirmación, declarar ausencia si `confianza` es baja, sin asesoría legal. Temperatura 0.
3.  Solo se llama al modelo si la compuerta de confianza del motor lo permite; si no, se muestra el mensaje de ausencia sin gastar tokens.
4.  Cuota por usuario: 20 respuestas IA al día (los pasajes siguen ilimitados dentro del rate limit). Registrar modelo, tokens y latencia en `consultas`.
5.  Streaming a la interfaz; el disclaimer se muestra siempre.
6.  Evaluar con tus `preguntas-doradas.json` antes de activar: mismas 3-4 candidatas de la sección 08, misma pregunta, comparar citas correctas.

**Listo cuando** las preguntas doradas obtienen respuestas con citas correctas y el costo por 100 respuestas está medido en el panel.

### Fase 6 · Operación continua

Transversal

- Backups automáticos de Postgres en Railway (diarios) + un `pg_dump` semanal a tu VPS o Drive vía cron.
- Uptime: monitor externo gratuito (UptimeRobot o Better Stack) sobre `/api/health`, alerta a tu Telegram vía n8n.
- Errores: Sentry (plan gratuito) en cliente y servidor.
- Analítica sin cookies: Umami self-hosted en tu Easypanel o Plausible. Vercel Analytics desaparece con la migración.
- Alerta si `actualizar-diario.js` lleva más de 3 días sin commit (tu PRD ya lo pide: un scraper que falla en silencio es el peor escenario).

## 04 · Modelo de datos

Better Auth crea `user`, `session`, `account` y `verification`. Lo propio es esto (Drizzle, Postgres):

    perfil            user_id PK→user, empresa, cargo, tipo_perfil, telefono,
                      fuente_registro, acepta_privacidad_at, acepta_novedades bool,
                      utm_source/medium/campaign, created_at

    consultas         id, user_id→user, pregunta, filtros jsonb, k,
                      recomendacion, confianza, cobertura_top, margen,
                      conceptos_fuera jsonb, top_cita, top_score,
                      respuesta_llm text NULL, modelo, tokens_in, tokens_out,
                      latencia_ms, created_at
                      índices: (user_id, created_at), (created_at), gin(conceptos_fuera)

    consulta_citas    consulta_id→consultas, posicion, cita, score   -- top k, para auditar

    feedback          id, consulta_id→consultas, user_id, util bool, comentario, created_at

    reservas          id, user_id NULL→user, nombre, email, empresa, motivo,
                      inicio timestamptz, fin timestamptz, google_event_id, meet_url,
                      estado (confirmada|cancelada|reprogramada), token_gestion, created_at

    agenda_config     id=1, duracion_min, buffer_min, dias jsonb, hora_inicio, hora_fin,
                      antelacion_h, horizonte_d, calendarios jsonb, zona

    rate_limit        clave (user:id|ip:x), ventana_inicio, contador

Vista `leads` para el panel: usuario + perfil + `count(consultas)` + última consulta + `bool_or(reservas)`. Con eso el panel y el CSV son una sola consulta SQL.

## 05 · Registro y protección del backend

### Qué significa "proteger el front del backend" acá

- El navegador nunca recibe el corpus ni las llaves: la búsqueda corre en el servidor y devuelve solo resultados. Eso ya es así; se mantiene.
- Toda ruta que entregue datos exige sesión. La cookie es httpOnly + Secure + SameSite=Lax, firmada por Better Auth. No hay tokens en `localStorage`.
- Las rutas de auth y búsqueda tienen rate limit, y `/api/search` valida y acota parámetros (ya lo hace con `k`).
- Cabeceras de seguridad en `next.config.ts`: CSP, HSTS, X-Frame-Options, Referrer-Policy.
- Postgres no tiene IP pública: solo red privada de Railway. Las llaves viven en variables de Railway, nunca en el repo.
- `/admin` compara el correo de la sesión contra `ADMIN_EMAILS`; no hay "rol" que un usuario pueda cambiarse solo.

### Por qué Google + enlace mágico

Tu público (QF, consultores, importadores) casi siempre entra desde una cuenta Google corporativa o personal. Un clic y ya tienes nombre y correo verificado. El enlace mágico cubre a quien no quiere usar Google y evita gestionar contraseñas, recuperaciones y fugas. Better Auth trae ambos como plugins y guarda todo en tus tablas.

## 06 · Leads y retroalimentación de la base

Un lead acá no es "un correo": es una persona identificada, con empresa y cargo, de la que sabes exactamente qué problema regulatorio está tratando de resolver y cuándo. Eso vale más que cualquier formulario de contacto. El plan captura tres capas:

1.  **Quién**: registro + perfil obligatorio en el primer ingreso (sin perfil no hay búsqueda). Guardar también UTM de la URL de llegada, para saber si vino de LinkedIn.
2.  **Qué**: cada consulta, con su confianza y los conceptos que el corpus no cubrió. Las preguntas de baja confianza son a la vez oportunidades de asesoría (la persona no encontró respuesta) y backlog de normas por agregar.
3.  **Cuán cerca**: reserva de llamada en `/agenda`, feedback, frecuencia de uso. De ahí sale el score de "lead caliente" del panel.

La base se "retroalimenta" en dos sentidos concretos: (a) el ranking de conceptos fuera del corpus te dice qué ingerir con `build_corpus.py`; (b) el feedback negativo por cita te marca metadatos mal derivados u OCR malo, que es justo lo que tu auditoría identificó como la fuente de error real.

La sincronización a Klaviyo (perfiles + evento "consulta") o Notion se deja como un webhook n8n opcional en el registro y en cada consulta. Así el flujo de nurturing por correo se arma sin tocar la app.

## 07 · Agenda personal en `/agenda`

Funciona como Calendly pero contra tus calendarios reales y con tus reglas. Flujo técnico:

1.  Cliente pide `/api/agenda/huecos?desde=2026-09-07&hasta=2026-09-27`.
2.  Servidor llama `freebusy.query` con los IDs de tus calendarios (todos los que quieras bloquear: World Courier, diplomado, Inacap, personal).
3.  Genera slots de 30 min dentro de la ventana lun-vie configurada, descarta los que chocan con ocupados ± 15 min de buffer y los que están a menos de 24 h.
4.  Al reservar, vuelve a consultar freebusy para ese slot (dos personas pueden mirar la misma hora), crea el evento con `conferenceDataVersion=1` y `sendUpdates=all` para que Google mande la invitación; además Resend envía tu confirmación con marca RegulaMED.

Detalle que rompe agendas

Los feriados chilenos no aparecen en freebusy salvo que el calendario "Festivos en Chile" esté en tu lista de calendarios a considerar. Inclúyelo en `agenda_config.calendarios`. Y si un calendario es de tu cuenta corporativa (World Courier), tendrás que compartir su disponibilidad con tu Gmail o replicar los bloques como eventos en tu calendario personal; de lo contrario esos huecos aparecerán libres.

Extensible después: varios tipos de reunión (15 min diagnóstico gratuito / 45 min asesoría), preguntas previas por tipo, y reutilizar el mismo módulo para VINIQ desde otro dominio.

## 08 · Capa de IA: opciones baratas y gratuitas

Una consulta típica del cerebro envía al modelo unos 8 pasajes (≈4.000 tokens) más instrucciones (≈1.000) y recibe ≈500 tokens de respuesta. Con eso, el costo por consulta y por cada 1.000 consultas queda así (precios de lista, septiembre 2026, sin caché ni batch):

| Proveedor / modelo                         | Entrada US\$/M | Salida US\$/M | ≈ por consulta | ≈ 1.000 consultas | Notas                                                                                                                                                                   |
|--------------------------------------------|----------------|---------------|----------------|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Groq · gpt-oss-120b recomendado            | 0,15           | 0,60          | \$0,001        | \$1,05            | Muy rápido, modelo abierto de OpenAI, buen español. Tier gratis para desarrollar (30 RPM, 1.000 req/día, pero solo 8K tokens/min: sirve para probar, no para usuarios). |
| Google · Gemini 3.5 Flash-Lite alternativa | 0,30           | 2,50          | \$0,003        | \$2,75            | Excelente en español, contexto enorme. En tier pago Google no usa tus datos para entrenar; en el gratuito sí.                                                           |
| OpenAI · GPT-5.6 Luna                      | 0,20           | 1,20          | \$0,002        | \$1,60            | Modelo económico de OpenAI. Sin tier gratuito.                                                                                                                          |
| DeepSeek · V4 Flash                        | 0,44           | 1,32          | \$0,003        | \$2,86            | Mitad de precio fuera de hora punta. Los datos viajan a servidores en China: no lo usaría con consultas que pueden contener información confidencial de laboratorios.   |
| Anthropic · Claude Haiku 4.5               | 1,00           | 5,00          | \$0,008        | \$7,50            | Muy fiel a las instrucciones de citar. Con caché del prompt fijo baja ~25%.                                                                                             |
| Anthropic · Claude Sonnet 5                | 2,00           | 10,00         | \$0,015        | \$15,00           | Referencia de calidad. Para este uso (resumir 8 pasajes con citas) es más de lo necesario.                                                                              |

### ¿Existe una opción gratuita que funcione?

| Opción                            | Límite real                                                                                                                                                           | Veredicto para RegulaMED                                                                                                                                                                                                       |
|-----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Gemini API tier gratuito gratis   | Sin tarjeta. Del orden de 15 req/min y ~1.500 req/día en Flash; los Pro salieron del gratis en abril 2026. Google puede usar el contenido para mejorar sus productos. | Sirve para el lanzamiento si aceptas que las consultas se usen para entrenar. Para un producto que promete confidencialidad, no. Pasar a pago con Flash-Lite cuesta centavos y elimina ese problema.                           |
| Groq tier gratuito gratis         | 30 RPM, 1.000 req/día, 8K tokens/min por modelo.                                                                                                                      | Ideal para desarrollar y evaluar con las preguntas doradas. El límite de tokens por minuto (una consulta ≈5K) lo hace inviable con más de un usuario simultáneo. Con tarjeta (sin cobro mínimo) sube 10× y baja 25% el precio. |
| OpenRouter modelos `:free` gratis | 20 req/min, 200 req/día; los modelos gratis se quitan sin aviso.                                                                                                      | Solo para experimentar. No para producción.                                                                                                                                                                                    |
| Modelo propio en tu VPS (Ollama)  | Tu VPS ya se quedó sin memoria con modelos locales; un modelo decente en español necesita ≥16 GB RAM o GPU.                                                           | Descartado hasta que cambies de VPS. Un 7B cuantizado responde peor que gpt-oss-120b y más lento.                                                                                                                              |

Recomendación

Desarrollar y evaluar con Groq gratis; lanzar con Groq pago (gpt-oss-120b) o Gemini Flash-Lite pago según cuál cite mejor en tus preguntas doradas. Con 1.000 consultas IA al mes gastas entre US\$1 y US\$3. Dejar Claude Haiku como segundo proveedor configurado para comparar calidad en casos difíciles. El AI SDK hace que cambiar sea una variable de entorno.

## 09 · Dominio y corte sin pérdida

1.  Desplegar y probar todo en `regulamed.up.railway.app` con `NEXT_PUBLIC_SITE_URL` apuntando ya a regulamed.cl (los enlaces internos son relativos, no afecta).
2.  Bajar el TTL del DNS a 300 s un día antes.
3.  Agregar el dominio en Railway, crear CNAME (www) y el registro para el apex que tu DNS soporte (ALIAS/ANAME/CNAME flattening; si solo permite A, Railway entrega IPs). Esperar el certificado.
4.  Verificar dominio en Resend (SPF, DKIM, DMARC) para `acceso@` y `contacto@regulamed.cl`.
5.  Cambiar Vercel a redirección 301 permanente. Search Console: propiedad nueva + "cambio de dirección".
6.  Actualizar la URL en LinkedIn, firma de correo y el skill de contenido.

## 10 · Operación

| Área           | Decisión                                                                                                                                                       |
|----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Deploys        | Push a `main` → build → healthcheck → cambio de tráfico. Rama `dev` con entorno "staging" en Railway (PR environments) y su propia DB para probar migraciones. |
| Migraciones DB | `drizzle-kit migrate` al arrancar el contenedor; nunca `push` en producción.                                                                                   |
| Backups        | Backups de Railway + `pg_dump` semanal externo. Probar una restauración una vez.                                                                               |
| Logs           | Logs estructurados (JSON) con `request_id`; Railway los retiene según plan. Sentry para excepciones.                                                           |
| Memoria        | El corpus indexado en memoria pesa entre 100 y 300 MB. Fijar 1 GB para el servicio y revisar el uso real la primera semana.                                    |
| Cron           | Servicio cron de Railway (o el mismo servicio con `node-cron`) para recordatorios de agenda y correo semanal.                                                  |
| Costos         | Alerta de uso en Railway a US\$15/mes.                                                                                                                         |

## 11 · Privacidad y legal (Chile)

- **Política de privacidad y términos** visibles en registro y en el pie. Chile pasa de la Ley 19.628 a la nueva Ley 21.719 de protección de datos personales, cuya entrada en vigencia está fijada para diciembre de 2026: exige base de licitud, finalidad informada, derechos ARCO-P y una Agencia fiscalizadora con multas. Diseñar desde ya con consentimiento explícito, finalidad declarada ("mejorar el corpus y contactarte sobre asesoría"), y posibilidad de borrar la cuenta.
- **Dos consentimientos separados**: uso del servicio (obligatorio) y comunicaciones comerciales (opcional). Guardar fecha y versión aceptada.
- **Confidencialidad de consultas**: tu PRD ya lo dice; el contrato con el proveedor de IA debe prohibir entrenamiento con tus datos (tier pago de Google, Groq, OpenAI y Anthropic lo cumplen; el gratuito de Google no).
- **Disclaimer** en cada respuesta: herramienta de apoyo, no asesoría regulatoria ni legal.
- **Borrado**: botón "eliminar mi cuenta" que anonimiza consultas (conserva la pregunta para el corpus, elimina el vínculo con la persona).

Nota: esto es orientación técnica, no asesoría legal. Vale la pena que un abogado revise los textos antes del lanzamiento, como ya anticipaba tu PRD.

## 12 · Costo mensual estimado

| Servicio                                    | US\$/mes   | Comentario                                                                                                                                        |
|---------------------------------------------|------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Railway Hobby (app 1 GB + Postgres pequeño) | 5 – 12     | US\$5 fijos incluyen US\$5 de uso; RAM se cobra a US\$10/GB-mes prorrateado, CPU US\$20/vCPU-mes. Con tráfico bajo suele quedar cerca del mínimo. |
| Postgres                                    | incl.      | Dentro del uso de Railway (~0,3 GB RAM + volumen a US\$0,15/GB).                                                                                  |
| Resend                                      | 0          | Plan gratuito: 3.000 correos/mes, 100/día (verificar al contratar). Magic links + confirmaciones caben de sobra.                                  |
| Google Cloud (OAuth, Calendar API)          | 0          | Sin costo a este volumen.                                                                                                                         |
| IA (Fase 5, 1.000 consultas/mes)            | 1 – 3      | Groq gpt-oss-120b o Gemini Flash-Lite.                                                                                                            |
| Sentry, UptimeRobot, Umami                  | 0          | Planes gratuitos / self-hosted en tu VPS.                                                                                                         |
| Dominio regulamed.cl                        | ≈1         | Ya lo tienes; renovación anual NIC Chile.                                                                                                         |
| **Total**                                   | **7 – 17** | Vercel Hobby era gratis, pero no permitía uso comercial ni proceso persistente para el índice.                                                    |

## 13 · Lo que faltaba considerar

Cosas que no mencionaste y que cambian el resultado si se dejan para después:

- **El token de GitHub expuesto** (Fase 0). Es lo más urgente del plan.
- **Correo transaccional con tu dominio**: sin SPF/DKIM en regulamed.cl los magic links caen a spam y el registro "no funciona". Es un paso de DNS, no de código, pero bloquea la Fase 2.
- **Perfil obligatorio**: registrar solo el correo de Google da leads pobres. Pedir empresa y cargo en el primer ingreso multiplica el valor de la base.
- **No perder la pregunta al pedir registro**: llevar el texto que la persona escribió a través del login es lo que convierte curiosos en cuentas.
- **Refresh token de Google en modo testing**: caduca cada 7 días; la agenda hay que publicarla en producción en Google Cloud.
- **Feriados y calendario corporativo** en freebusy (sección 07).
- **Redeploy diario por el corpus**: sin watch paths, cada commit "+0/~0/-0" reconstruye la app.
- **Analítica**: al salir de Vercel pierdes Vercel Analytics; hay que reemplazarla.
- **Ley 21.719** vigente desde diciembre 2026: consentimiento y borrado desde el diseño, no como parche.
- **Staging**: un entorno de prueba con su propia DB para no probar migraciones sobre los leads reales.
- **Términos de uso** con disclaimer de no-asesoría, hoy inexistentes en la web.
- **Costo de IA por usuario**: cuota diaria para que un usuario (o un bot) no te consuma el presupuesto.

## 14 · Variables de entorno en Railway

    # Sitio
    NEXT_PUBLIC_SITE_URL=https://regulamed.cl
    NODE_ENV=production

    # Base de datos (URL privada de Railway)
    DATABASE_URL=postgresql://…@postgres.railway.internal:5432/railway

    # Better Auth
    BETTER_AUTH_SECRET=
    BETTER_AUTH_URL=https://regulamed.cl
    GOOGLE_CLIENT_ID=…            # cliente "login usuarios"
    GOOGLE_CLIENT_SECRET=…
    ADMIN_EMAILS=tu-cuenta-google@gmail.com,contacto@regulamed.cl

    # Correo
    RESEND_API_KEY=…
    CONTACTO_FROM=RegulaMED 
    CONTACTO_TO=contacto@regulamed.cl
    AUTH_EMAIL_FROM=RegulaMED 

    # Agenda (cliente OAuth "agenda interna", tu cuenta)
    GOOGLE_AGENDA_CLIENT_ID=…
    GOOGLE_AGENDA_CLIENT_SECRET=…
    GOOGLE_REFRESH_TOKEN=…
    AGENDA_TZ=America/Santiago

    # IA (Fase 5)
    LLM_PROVIDER=groq              # groq | google | openai | anthropic
    LLM_MODEL=openai/gpt-oss-120b
    GROQ_API_KEY=…
    GOOGLE_GENERATIVE_AI_API_KEY=…
    LLM_CUOTA_DIARIA=20

    # Opcional
    CEREBRO_LOG_WEBHOOK=…          # n8n → Sheets / Klaviyo / Notion
    SENTRY_DSN=…

## 15 · Fuentes consultadas

- [Railway · Plans & pricing](https://docs.railway.com/reference/pricing/plans) (Hobby US\$5 con US\$5 incluidos; RAM US\$10/GB, CPU US\$20/vCPU, volumen US\$0,15/GB).
- [Google · Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) (Flash-Lite 0,30/2,50; uso de datos en tier gratuito vs pago).
- [Google · Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) y [resumen de límites del tier gratuito 2026](https://tinkerllm.com/blog/gemini-api-free-tier-limits-rate-quotas/).
- [Groq · Rate limits](https://console.groq.com/docs/rate-limits) y [precios Groq 2026](https://tokenmix.ai/blog/groq-api-pricing).
- [Anthropic · Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing).
- [OpenAI · API pricing](https://openai.com/api/pricing/).
- [DeepSeek · Pricing](https://api-docs.deepseek.com/quick_start/pricing).
- [OpenRouter · modelos gratuitos y límites](https://costgoat.com/pricing/openrouter-free-models).
- [Next.js + Drizzle + Better Auth](https://better-fullstack.dev/guides/typescript/nextjs-drizzle-better-auth) (guía de integración).
- Código propio: `APP-Regulatoria/web` (search.ts, rutas API, site.ts) y `PRD-cerebro-regulatorio.md`.
