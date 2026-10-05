# RegulaMED — estado y pendientes · 05-10-2026

Revisión de regulamed.cl en producción, del repo `Nico-Roman/cerebro-regulatorio` y de GitHub Actions, hecha el 05-10-2026 (18:00 Santiago).

## Actualización del 05-10, 19:45

- **Hotfix en producción.** PR 3 mergeado en `main` (`3e07317`); el PR 1 quedó cerrado como mergeado. Web CI verde y Railway desplegó bien.
- **Verificado en regulamed.cl:** los puntos 1 a 10 de la tabla de abajo ya no ocurren (sin instrucciones del video, `/planes` y `www` redirigen con 308, sin «World Courier», `og:image` de 1200×630, canonical propio en `/agenda`, 404 en español, sitemap con 5 URLs).
- **Sin comprobar en producción:** que los topes de uso cuenten. El arreglo está desplegado y tiene prueba, pero probarlo en vivo exige enviar formularios o entrar con una cuenta.
- **DMARC publicado.**
- **Sigue abierto:** P0 3 a 5 y todo el PR 2 (`/cobertura`, `/historial`, flujos del asistente, términos y privacidad nuevos todavía no existen en producción).

## En una línea

Producción sigue corriendo el código del 24-09. Los dos PR con los arreglos (PR 1 del 24-09 y PR 2 del 01-10) están abiertos y sin merge, así que todo lo que se decidió hace once días todavía no se ve en el sitio. Dejé una rama lista (`claude/hotfix-produccion-2026-10-05`) con lo urgente; falta que Nico la suba y la mergee.

## Lo que se ve mal hoy en regulamed.cl (verificado)

| # | Qué | Dónde | Se arregla con |
|---|---|---|---|
| 1 | Instrucciones internas a la vista: «Video pendiente de publicación · Sube el video a YouTube… NEXT_PUBLIC_VSL_YOUTUBE_ID» | Home y `/asesoria` | Hotfix |
| 2 | `/planes` publicado con precios ($10.000 y $100.000 al mes, packs) que se descartaron el 23-09; además está en el sitemap | `/planes` | Hotfix |
| 3 | «World Courier» con nombre en la trayectoria (decisión del 24-09: no nombrar al empleador) | `/asesoria` | Hotfix |
| 4 | Ningún límite de uso funciona: 60 búsquedas/hora, formulario de contacto, 5 reservas/hora por IP, ráfaga y techo diario de la IA. El contador vuelve a 1 en cada petición | Servidor | Hotfix |
| 5 | Next 16.3.5 con aviso crítico (RCE en `next/og`, GHSA-vcvr-r3jv-pc5j) | Dependencias | Hotfix |
| 6 | `www.regulamed.cl` responde 200 en vez de redirigir: sitio duplicado para Google | DNS/servidor | Hotfix |
| 7 | Sin `og:image`: al compartir en WhatsApp o LinkedIn no sale imagen | Todo el sitio | Hotfix |
| 8 | `/agenda` declara como canonical la home | `/agenda` | Hotfix |
| 9 | Página 404 en inglés | Rutas inexistentes | Hotfix |
| 10 | El sitemap lista `/normativa`, que redirige al login | `sitemap.xml` | Hotfix |
| 11 | Voz mezclada «yo» / «nosotros» | Home y `/asesoria` | PR 2 |
| 12 | Términos y privacidad en su versión antigua; no existen `/cobertura` ni `/historial` | Legal | PR 2 |
| 13 | ~~Sin registro DMARC en el dominio~~ | DNS (Vercel) | **Resuelto el 05-10**: Nico lo agregó y resuelve en DNS público |
| 14 | Sin analítica y sin verificación visible de Search Console (ni TXT ni meta); en mi búsqueda el dominio no apareció | SEO | Nico |
| 15 | Sin cabecera Content-Security-Policy (las demás cabeceras de seguridad están) | Servidor | Baja prioridad |

Lo que sí está bien: el sitio responde rápido (menos de 0,2 s al primer byte, medido desde fuera de Chile), HTTPS y HSTS correctos, la agenda entrega horas reales de 10:00 a 12:00, el correo tiene SPF y DKIM, los respaldos de Postgres corren (último el 04-10) y de los hallazgos mayores del 11-09, M1, M4 y M5 están cerrados en el código y M3 quedó mitigado (el tope por norma subió de 2 a 4).

No probé lo que exige enviar algo de verdad o entrar con una cuenta: formulario de contacto, reserva de hora, login, buscador y respuestas con IA.

## Corpus diario: tres fallas seguidas

- Última actualización publicada: 02-10. `/api/estado` marca 3 días y sigue «fresco» (el umbral de vencido es 7).
- 03-10 y 04-10: el paso que verifica la conexión con el ISP cortó por timeout (curl 28) antes de bajar nada.
- 05-10: GitHub no asignó runner y canceló el job. No es del repo.
- Patrón: **falla todos los sábados y domingos desde el 12-09, 8 de 8**. De lunes a viernes pasaba 18 de 18 hasta hoy. Solo abrí el detalle de las dos de este fin de semana; las seis anteriores las cuento por su resultado.
- Aviso de GitHub: desde el 19-10-2026 `ubuntu-latest` pasa a Ubuntu 26. Si el corpus falla ese día, esa es la primera sospecha.

## Lo que hice hoy

Rama `claude/hotfix-produccion-2026-10-05` (commit `9337cdb`), creada en el repo local del PC de Nico. No toqué `main`, el working tree ni nada en producción.

1. Merge del PR 1 sobre `main` al 02-10 (parches 1–7, 9, 10 y 11 de la auditoría).
2. `fix(web)`: `desfaseZona` sin milisegundos, con prueba de regresión. La prueba falla con el código de producción (0/3) y pasa con el arreglo (3/3).
3. `deps(web)`: Next 16.3.8. El aviso crítico desaparece de `npm audit`.
4. `web`: «World Courier» → «Operador logístico farmacéutico multinacional».
5. `ci(corpus)`: la verificación del ISP reintenta hasta 5 veces antes de botar la corrida.

Verificado: lint sin errores, tipos, 22/22 pruebas, build de producción y `npm audit --omit=dev` sin críticos. Con el build levantado: sin instrucciones del video en home ni en `/asesoria`, `/planes` → 308, `www` → 308 a `regulamed.cl`, `og:image` de 1200×630, 404 en español y sitemap con 5 URLs. El PR 2 se mergea encima sin conflictos (60/60 pruebas).

No verificado: contra Postgres real ni con el modelo real (acá no hay base ni clave), y el cambio del workflow no corrió en Actions.

Respaldo de la rama: `Claude outputs/hotfix-produccion-2026-10-05.bundle`.

## Pendientes, por orden

### P0 — esta semana

1. ~~**Subir y mergear el hotfix.**~~ Hecho el 05-10 (PR 3). Texto original: En el PC: `git push origin claude/hotfix-produccion-2026-10-05`, abrir el PR y mergear. Railway despliega solo. Al mergear, el PR 1 queda cerrado como mergeado. Ojo: desde ese despliegue los topes se aplican de verdad (10 preguntas con IA al día por persona, 60 búsquedas por hora).
2. ~~**DMARC.**~~ Hecho el 05-10: `TXT _dmarc` = `v=DMARC1; p=none; rua=mailto:contacto@regulamed.cl; adkim=r; aspf=r`. Los informes llegan a contacto@regulamed.cl; cuando lleven unas semanas sin fallas propias se puede subir a `p=quarantine`.
3. **Repo a privado** (se abrió el 24-09 para una revisión y sigue público). Después, confirmar que Railway despliega el merge siguiente.
4. **Confirmar que el token de GitHub expuesto el 03-09 está revocado.**
5. **Corpus de fin de semana**: decidir si el cron pasa a lunes–viernes o se queda como está con dos correos de falla cada fin de semana.

### P1 — para lanzar (PR 2)

6. Correr «Corpus diario» sobre la rama del PR 2 **antes** del merge (dispositivos médicos). Si las doradas `dm-*` no pasan, la compuerta frena también el corpus de `main`.
7. Enlace del Decreto Exento 31/2026 (CVE 2782631) en `cerebro/fuentes-dispositivos.json` y revisar las citas `revisar_nico`.
8. Secretos de Actions: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`.
9. Las 50 preguntas de Nico y 30 reales en `preguntas-reales-100.json`; confirmar las 20 de la auditoría.
10. 20 observaciones del ISP reconstruidas en `casos-flujos/casos.json`.
11. Validar `lib/flujos/rutas.json` (todas en `validado_por_nico: false`) y recién ahí `FLUJO_TRAMITE=on` en Railway.
12. Fechas y detalle del cargo de director técnico (TODO en `lib/asesoria.ts`).
13. `SENTRY_DSN` y `NEXT_PUBLIC_SENTRY_DSN` en Railway.
14. Revisar y mergear el PR 2. Trae las migraciones 0011–0013.

### P1 — contenido que solo tiene Nico

15. Grabar el VSL de 6 minutos, subirlo a YouTube como no listado y definir `NEXT_PUBLIC_VSL_YOUTUBE_ID` en Railway.
16. `CIFRAS` (tres cifras reales) y `TESTIMONIOS` con nombre y empresa en `lib/site.ts`; `REGISTRO_PROFESIONAL` en `lib/asesoria.ts`.
17. Cuerpo normativo de las 4 guías (`lib/guias.ts`) y pasar `publicada: true`.

### P2 — SEO, legal y marca

18. Verificar el dominio en Search Console, enviar el sitemap y pedir indexación de home y `/asesoria`.
19. Decidir si se mide el tráfico (hoy no hay ninguna analítica).
20. Búsqueda del nombre en INAPI (única decisión abierta del 24-09).
21. Revisión con abogado: términos §05 y §10, privacidad §03, §05 y §08.
22. Ley 21.719: definir delegado de protección de datos y registro de actividades antes del 01-12-2026.
23. Titular de LinkedIn (dos borradores en el plan del 16-09).
24. Content-Security-Policy, probándola contra YouTube, Google y Sentry antes de activarla.
25. Limpieza del cobro, etapa 2 (borrar tablas y columnas de planes y créditos).

## Cerrado desde la última revisión

- El proyecto viejo de Vercel `cerebro-regulatorio` ya no existe (Nico lo borró); los commits no traen su check rojo. No hay que recrearlo: el sitio corre en Railway.
- Vercel revisado el 05-10 después del borrado: el dominio `regulamed.cl` sigue en el equipo con su zona DNS y todos los registros resuelven (ALIAS y CNAME a Railway, verificación de Railway, MX y SPF de ImprovMX, DKIM y envío de Resend). Certificados de Railway vigentes hasta el 08-12-2026.
- DMARC publicado el 05-10.
- M1 (frescura cacheada), M4 (secretos del respaldo) y M5 (HTML sin escapar en correos). M3 mitigado: el tope por norma pasó de 2 a 4.

## Datos de referencia

- `main` en `1390446` (corpus 02-10). Último commit de código: 24-09.
- PR 1: `claude/auditoria-puntos-parchados-30001m` (`a5cd6c9`). PR 2: `claude/arreglos-pendientes-plan-l14usy` (`b5b0a83`), Web CI en verde.
- Corpus: 133 documentos, 2.823 chunks, 124 normas en el listado oficial.
- IA en producción: `openai/gpt-oss-120b` en Groq, configurada.
- Corridas fallidas: https://github.com/Nico-Roman/cerebro-regulatorio/actions/runs/37131625277 · https://github.com/Nico-Roman/cerebro-regulatorio/actions/runs/37213499241 · https://github.com/Nico-Roman/cerebro-regulatorio/actions/runs/37363397232
- Aviso de Next: https://github.com/advisories/GHSA-vcvr-r3jv-pc5j
