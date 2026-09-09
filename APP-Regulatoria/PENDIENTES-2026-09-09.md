# Estado y pendientes — 9 de septiembre de 2026 (mediodía)

Reemplaza a `PENDIENTES-2026-09-08.md`. Aquel documento se escribió cuando la
app todavía no era alcanzable por su dominio; varias de sus premisas cambiaron.

---

## 1 · Lo que quedó verificado hoy, en producción

| Comprobación | Cómo se comprobó |
|---|---|
| `regulamed.cl` sirve la app | Navegación real al dominio: DNS, certificado y contenido nuevo |
| Login con Google | Se completó el flujo entero desde el dominio; la sesión quedó creada |
| Cuenta de administrador | `/admin` abre y lista al único usuario registrado |
| Correo saliente | Corrida verde de `resumen-semanal` tras corregir el remitente |
| Enlace mágico | `/ingresar` renderiza el campo de correo y el botón "Enviar enlace" |
| Corpus al día | `vigia-frescura` en verde contra `regulamed.cl/api/estado` |
| Páginas legales | `/privacidad` y `/terminos`, enlazadas desde el pie y en el sitemap |

## 2 · Bugs encontrados y corregidos

### 2.1 · El remitente de correo era el de pruebas de Resend `[corregido]`

`/api/cron/resumen-semanal` devolvía **500 con cuerpo vacío**. Los logs de
Railway tenían la causa exacta:

> `Resend respondió 403: You can only send testing emails to your own email
> address (…@privaterelay.appleid.com). To send emails to other recipients,
> please verify a domain … and change the 'from' address …`

`CONTACTO_FROM` valía `RegulaMED <onboarding@resend.dev>`. Con ese remitente
Resend solo acepta como destinatario al dueño de la cuenta, sin importar que el
dominio esté verificado. Se verificó por DNS que sí lo está —hay DKIM en
`resend._domainkey.regulamed.cl`, y SPF y MX en `send.regulamed.cl`— y se cambió
el remitente a `RegulaMED <contacto@regulamed.cl>`.

**Alcance real del bug:** no era solo el resumen semanal. `lib/correo.ts` es el
único punto de salida de correo, así que el formulario de contacto, el enlace
mágico y las confirmaciones de reunión habrían fallado igual con cualquier
persona que no fuera el dueño de la cuenta de Resend. Es decir: con todos los
usuarios reales.

### 2.2 · Los secretos estaban en el entorno, no en el repo `[corregido]`

`CRON_SECRET` y `ESTADO_URL` estaban definidos como secreto y variable del
**entorno** `Production`. Un workflow que no declara `environment:` recibe esos
valores vacíos. Consecuencias:

- `resumen-semanal` abortaba con "Falta el secret CRON_SECRET", aunque existía.
- `vigia-frescura` caía a su URL por defecto **en silencio** — el modo de falla
  más caro, porque el workflow quedaba verde vigilando el lugar equivocado.

Los dos declaran ahora `environment: Production`. El vigía además cambió su URL
por defecto a `regulamed.cl`, que cubre DNS y certificado; el subdominio de
Railway no detecta esas dos formas de caerse.

## 3 · Lo que se agregó

- `app/privacidad` y `app/terminos`, más `components/documento-legal.tsx`. Google
  exige tres URL del mismo dominio autorizado para publicar la app OAuth. La
  política declara el uso limitado de datos de las API de Google, que es lo que
  mira la verificación cuando hay scopes de Calendar.
- `.github/workflows/respaldo-postgres.yml`: volcado semanal, cifrado con AES
  antes de subirse como artefacto, con 90 días de retención. Los backups de
  Railway son del plan Pro y no se va a contratar por ahora.
- `AUTH_MAGIC_LINK` pasó de `0` a `1`.

---

# Lo que falta, y es solo tuyo

1. **Sincronizar el repo.** `git pull --rebase origin main` y después
   `git push origin main`. Dos commits se hicieron en GitHub y uno acá; el pull
   va primero o el push se rechaza.
2. **Completar tu perfil** en `/perfil`. Sin eso el buscador no se abre. No se
   llenó a propósito: uno de los campos es un consentimiento sobre tus datos.
3. **Publicar la app de Google.** Verifica `regulamed.cl` en Search Console con
   la misma cuenta —Google no acepta URL de dominios sin verificar— y luego pega
   `https://regulamed.cl`, `/privacidad` y `/terminos` en la pantalla de
   consentimiento. Publica en producción: en modo prueba el refresh token del
   calendario caduca a los 7 días. No hace falta enviarla a revisión.
4. **Encender la agenda.** Segundo cliente OAuth (redirección
   `http://localhost:5858/callback`), pegar ID y secreto en `.env.local`, correr
   `node --env-file=.env.local scripts/google-auth.mjs` y llevar las tres
   variables a Railway.
5. **Respaldos.** Crear los secrets `DATABASE_PUBLIC_URL` y `BACKUP_PASSPHRASE`
   en GitHub. La frase va donde guardas tus contraseñas: sin ella el respaldo no
   se abre, que es exactamente el punto.
6. **Apagar la tarea del Programador de tareas de Windows.** Hoy dejó un commit
   vacío mientras la nube hacía el suyo. No rompió nada, pero compiten.

Groq queda fuera por ahora: su página dio error al registrarse. Sin
`LLM_API_KEY` el botón de redacción no aparece y el buscador funciona igual.

---

## Riesgo conocido que sigue vigente

`drizzle/meta/_journal.json` solo conoce la migración `0000`. Las `0001`–`0003`
se escribieron a mano y el aplicador las lee de disco, así que funcionan; pero
si algún día corres `drizzle-kit generate`, va a creer que las tablas
`feedback`, `agenda_config` y `reservas` no existen y va a proponer crearlas de
nuevo. Regenera los snapshots antes de volver a usar esa herramienta.
