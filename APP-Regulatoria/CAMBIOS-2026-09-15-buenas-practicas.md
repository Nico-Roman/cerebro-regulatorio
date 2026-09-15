# Auditoría de buenas prácticas y correcciones — 15-09-2026

Revisión del código de regulamed.cl (app web, Dockerfile, workflows) buscando
malas prácticas, no funcionalidades nuevas. Todo lo de abajo está aplicado y
verificado en el PC con `lint`, `typecheck`, `test` y `build`.

**Sin commitear ni desplegar todavía.** Producción sigue en `51e98d4`. Ojo con
lo que ya estaba modificado en el working tree por otras sesiones
(`scripts/eval-ia-local.mjs`, `cerebro/preguntas-reales.json`, `.env.example`,
`preguntas-abuso.json`): no se tocó nada de eso.

## 1. Lo que estaba mal y ahora no

### Crítico

| Qué | Dónde | Arreglo |
|---|---|---|
| Next.js 16.3.0 con **dos RCE sin autenticar** (GHSA-p293-qw3h-jr36 en servidores Windows y GHSA-2xp9-vwfh-vxw4 en el optimizador de imágenes con AVIF) | `package.json` | 16.3.5 (y `eslint-config-next` igual). `npm audit fix` cerró además `nanoid` y `sharp` (altas). Quedan 4 moderadas, todas de `drizzle-kit`, que es herramienta de desarrollo y **no entra a la imagen**. |

### Alto

| Qué | Dónde | Arreglo |
|---|---|---|
| **El formulario de contacto no tenía límite de uso.** El honeypot era lo único entre un script y la casilla: se podía inundar `CONTACTO_TO` y quemar la cuota de Resend. | `app/api/contacto/route.ts` | 5 mensajes por hora por IP (la IP de Railway, no la que declara el cliente), con `Retry-After`. |
| **Inyección de fórmulas en el CSV del panel.** Una pregunta escrita como `=HYPERLINK("…")` llegaba viva a Excel/Sheets y se ejecutaba al abrir el export. | `lib/csv.ts` (nuevo) | Toda celda que empiece con `= + - @`, tabulador o CR se antepone con `'`. |

### Medio

| Qué | Dónde | Arreglo |
|---|---|---|
| El secreto del cron se comparaba con `===`: el tiempo de respuesta filtra cuántos caracteres se acertaron. | `app/api/cron/resumen-semanal/route.ts` | `timingSafeEqual`. |
| El correo del administrador y las métricas del negocio salían en el cuerpo de `/api/cron/resumen-semanal`, y el workflow lo imprime en el log de Actions — **este repo es público**. | misma ruta | La respuesta es `{ok:true}`. El contenido viaja por correo. |
| **Ningún `fetch` externo tenía timeout.** Un Resend o un Google que acepta la conexión y no responde deja la petición viva con su conexión de Postgres tomada. | `lib/correo.ts`, `lib/agenda/google.ts` | `AbortSignal.timeout` de 10 s en los cinco. (La llamada al modelo ya tenía 30 s.) |
| Faltaban HSTS y `Permissions-Policy`; se anunciaba el framework en cada respuesta. | `next.config.ts` | HSTS de 2 años (sin `includeSubDomains` ni `preload`: son difíciles de revertir), `Permissions-Policy` en vacío y `poweredByHeader: false`. |
| La URL canónica por defecto era `cerebro-regulatorio.vercel.app`, un despliegue que ya no existe. Un build sin el ARG mandaba enlaces de cancelación de reunión a la nada. | `lib/site.ts` | `https://regulamed.cl`. Misma corrección en el correo de cancelación, que tenía el dominio escrito a mano. |
| `leerConfig()` se comía **cualquier** error, incluida una base caída, y seguía como si nada con los valores por defecto. | `lib/agenda/config.ts` | Sigue devolviendo los valores por defecto, pero lo registra. Es el principio del proyecto: una falla muda no es aceptable. |

### Bajo

| Qué | Dónde | Arreglo |
|---|---|---|
| `JSON.stringify` dentro de `<script type="application/ld+json">` no escapa `<`: hoy los datos son constantes, pero el día que uno sea dinámico es un XSS. | `lib/html.ts` → `jsonParaScript()`, usado en `layout`, `page` y `asesoria` | `<`, `>` y `&` como `\uXXXX`. |
| La imagen de producción llevaba `scripts/` completo (evaluaciones del modelo, OAuth de Google). | `Dockerfile` | Copia solo `scripts/migrate.mjs`. |
| Cinco SVG de la plantilla de Next sin usar. | `web/public/` | Borrados. |
| `@types/node` en `^20` mientras el runtime es Node 22. | `package.json` | `^22`, más `engines.node: >=22.18`. |

## 2. Lo que no existía: verificación

- **`web/tests/seguridad.test.mts`** — 7 pruebas con el runner de Node (sin
  dependencias nuevas) sobre las funciones de las que depende que algo *no*
  pase: `destinoSeguro` (open redirect), `escaparHtml` / `urlSegura` /
  `jsonParaScript`, `ipCliente` (cabecera falsificada) y `celdaCsv` (fórmulas).
  Se eligieron esas porque cada una nació de un agujero real ya tapado, y sin
  prueba nada impide que se reabra. `npm test`.
- **`.github/workflows/web-ci.yml`** — lint, tipos, pruebas, build y
  `npm audit --omit=dev --audit-level=critical` en cada push y PR que toque
  `web/`. No detiene el deploy (Railway escucha a GitHub, no a Actions), pero
  pone el commit en rojo al minuto en vez de que producción sea el primer lugar
  donde se nota. El build corre **sin `DATABASE_URL`**, igual que en Docker.
- Scripts nuevos: `npm run typecheck` y `npm test`.
- `respaldo-postgres`, `resumen-semanal` y `vigia-frescura` ahora declaran
  `permissions: contents: read` y `timeout-minutes`. `corpus-diario` se deja
  como está: necesita `contents: write` para publicar el corpus.

## 3. Lo que se revisó y se decidió NO tocar

- **`rejectUnauthorized: false` en Postgres** (`lib/db/index.ts` y
  `scripts/migrate.mjs`). El proxy público de Railway presenta un certificado
  que no valida contra las CA del sistema; arreglarlo de verdad es traer la CA
  de Railway, no cambiar una línea. Queda anotado como pendiente real.
- **`sslDeUrl` duplicada** en el `.ts` y el `.mjs`: el aplicador de migraciones
  corre sin el resolvedor de rutas de Next y no puede importar del `lib/`.
- **CSP**: es el siguiente escalón después de estas cabeceras, pero hay que
  probarla contra el login de Google y el iframe de YouTube antes de publicarla.
  A ciegas rompe el sitio.
- **El pipeline del corpus** (`cerebro/*.js`, `*.py`): ya usa `execFileSync` con
  argumentos en arreglo, sin shell. No se encontró nada que corregir.
- `lib/search.ts` tiene 989 líneas y pide partirse, pero eso es una refactorización
  con riesgo de regresión en el motor de búsqueda, no una corrección.

## 4. Verificación

```
npm run lint       ✓ sin hallazgos
npm run typecheck  ✓ sin errores
npm test           ✓ 7/7
npm run build      ✓ 31 rutas, sin DATABASE_URL real
npm audit --omit=dev --audit-level=critical  ✓
```
