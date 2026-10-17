# RegulaMED — cambios y pendientes

**Único documento de estado.** Reemplaza a los `CAMBIOS-2026-09-*`, `CAMBIOS-2026-10-01`, `PENDIENTES-2026-09-10` y `pendientes-regulamed-2026-10-05`, que se borraron (siguen en el historial de git). Al cerrar un pendiente, táchalo aquí; no crees otro archivo de estado.

Actualizado el 05-10-2026, contrastando los documentos con el repo, GitHub Actions y la API de GitHub.

## 1. Dónde estamos

- **Producción** (`regulamed.cl`, Railway): `main` en `3e07317` + notas. Tiene el hotfix del 05-10 (PR 3) y el código del 24-09. **No tiene el PR 2.**
- **PR 2** (`claude/arreglos-pendientes-plan-l14usy`): abierto, sin merge. Web CI verde, «Corpus diario» lanzado a mano sobre la rama: **verde** (05-10, 23:59). Trae `/cobertura`, `/historial`, flujos del asistente, dispositivos médicos, términos y privacidad nuevos, y las migraciones 0011–0013.
- **Repo** `Nico-Roman/cerebro-regulatorio`: sigue **público** (verificado hoy).
- **IA en producción:** `openai/gpt-oss-120b` en Groq.
- **Corpus:** 133 documentos, 2.823 chunks (más dispositivos médicos en la rama del PR 2).

## 2. Pendientes vigentes

### Ahora — cerrar el PR 2

1. **`LLM_API_KEY` en Actions** (secreto) y variables `LLM_BASE_URL`, `LLM_MODEL`. Las evaluaciones del asistente y de los flujos corrieron **sin modelo**; sin esto no hay medida real de calidad. *(No pude comprobar si ya está cargado.)*
2. **Revisar las citas `revisar_nico`** de las doradas `dm-*` y de los Decretos Exentos 25 y 31/2026 (el enlace del DE 31, CVE 2782631, ya está en `cerebro/fuentes-dispositivos.json`; falta contrastar la descripción y la cita de `dm-reactivos-donantes`).
3. **Mergear el PR 2 con «Create a merge commit».** Aplica las migraciones 0011–0013 al arrancar. Desde el despliegue anterior ya se aplican de verdad los topes de uso (10 preguntas con IA por persona al día, 60 búsquedas por hora).
4. Si `main` avanzó (corpus diario), el PR 2 puede necesitar traerlo otra vez.

### Contenido que solo tiene Nico (lo que frena el lanzamiento)

5. `cerebro/preguntas-reales-100.json`: 50 preguntas propias (`n01`–`n50`, vacías), 30 reales de la tabla `consultas` (`c01`–`c30`, vacías) y confirmar las 20 de la auditoría (`a01`–`a20`, con norma y cita propuestas).
6. `cerebro/casos-flujos/casos.json`: 20 observaciones del ISP reconstruidas (`o01`–`o20`, vacías).
7. `web/lib/flujos/rutas.json`: 13 rutas, 0 validadas, 9 citas «por confirmar». Después, `FLUJO_TRAMITE=on` en Railway.
8. Fechas y detalle del cargo de director técnico (TODO en `web/lib/asesoria.ts`); `REGISTRO_PROFESIONAL` en el mismo archivo.
9. VSL de 6 minutos: grabar, subir a YouTube como no listado y definir `NEXT_PUBLIC_VSL_YOUTUBE_ID` en Railway.
10. `CIFRAS` (tres cifras reales) y `TESTIMONIOS` con nombre y empresa en `web/lib/site.ts`.
11. Cuerpo normativo de las 4 guías (`web/lib/guias.ts`) y pasar `publicada: true`.

### Seguridad y operación

12. **Confirmar que el token de GitHub expuesto el 03-09 está revocado.** El listado viejo que lo mencionaba quedó commiteado en un repo público.
13. **Repo a privado**, después del merge del PR 2; confirmar que Railway despliega el merge siguiente.
14. `SENTRY_DSN` y `NEXT_PUBLIC_SENTRY_DSN` en Railway (opcional para lanzar; el segundo se fija en el build).
15. **Corpus de fin de semana:** falló 8 de 8 sábados y domingos desde el 12-09 (de lunes a viernes pasaba 18 de 18). Decidir: cron de lunes a viernes o dejarlo. El fin de semana del 10-10 es el primero con reintentos del paso del ISP.
16. **19-10-2026:** `ubuntu-latest` pasa a Ubuntu 26. Si el corpus falla ese día, primera sospecha.
17. DMARC está en `p=none`; subir a `p=quarantine` cuando los informes lleguen unas semanas sin fallas propias.
18. **Comprobar en vivo que los topes de uso cuentan** (60 búsquedas/hora, formulario de contacto, 5 reservas/hora por IP, ráfaga de IA). El arreglo está desplegado y tiene prueba de regresión, pero probarlo exige enviar formularios o entrar con una cuenta.

### SEO, legal y marca

19. Search Console: verificar el dominio, enviar el sitemap, pedir indexación de home y `/asesoria`.
20. Decidir si se mide el tráfico (hoy no hay analítica).
21. Búsqueda del nombre en INAPI (única decisión abierta del 24-09).
22. **Revisión con abogado:** Términos §05 (alcance de responsabilidad de quien pega el texto y detección de datos de pacientes) y §10 (responsabilidad limitada a lo pagado en 12 meses, hoy $0, junto a dolo, culpa grave y derechos del consumidor); Privacidad §03 (bases legales: contrato e interés legítimo), §05 (transferencia a EE. UU. sin cláusulas tipo declaradas) y §08 (retención de 12 meses identificable, después disociada: es una propuesta).
23. **Ley 21.719 (antes del 01-12-2026):** definir si corresponde delegado de protección de datos y registro de actividades de tratamiento.
24. Titular de LinkedIn (dos borradores en el plan del 16-09).

### Técnico, sin urgencia

25. **IA / Groq:** activar *Zero Data Retention* en Data Controls (un clic, solo Nico) y decidir el tier Developer (el tope diario del tier gratis ya cortó las evaluaciones). Sigue sin medirse el prompt `2026-09-14b` en 7 preguntas (h16, h17, h18, h19, h20, h22, h24) ni el holdout con prompt v2:
    `node --experimental-strip-types --no-warnings scripts/eval-ia-local.mjs --solo h16-contrato,h17-optica,h18-esavi,h19-farmacia,h20-gondolas,h22-arancel,h24-equivalente-farmaceutico`
26. **Consulta de control semanal de la IA** (si `datos_sin_respaldo` sube, el modelo está rellenando; si `bloqueado` crece por `tarea`, lo usan como asistente general: decisión de producto):
    ```sql
    SELECT count(*) AS borradores,
      count(*) FILTER (WHERE abstuvo) AS se_abstuvo,
      count(*) FILTER (WHERE citas_invalidas) AS cita_invalida,
      count(*) FILTER (WHERE sin_citas) AS sin_cita,
      count(*) FILTER (WHERE datos_no_verificados IS NOT NULL) AS datos_sin_respaldo,
      count(*) FILTER (WHERE caso_no_cubierto IS NOT NULL) AS caso_no_cubierto,
      sum(tokens_in), sum(tokens_out),
      count(*) FILTER (WHERE tokens_in = 0) AS desde_cache
    FROM consultas
    WHERE respuesta_llm IS NOT NULL AND created_at > now() - interval '7 days';

    SELECT bloqueado, count(*) FROM consultas
    WHERE bloqueado IS NOT NULL AND created_at > now() - interval '7 days'
    GROUP BY 1 ORDER BY 2 DESC;
    ```
27. **Paráfrasis inventada sin cifras ni normas** («el titular debe además informar al Ministerio»): ningún verificador mecánico la ve. El PR 2 agrega verificación por afirmación, pero no se reevaluó para este caso; la opción pendiente es una segunda llamada de fidelidad por muestreo (1 de cada 20).
28. **Registro abierto:** el techo del sitio acota el gasto de IA, no el acceso.
29. **Compuerta del corpus:** recall@5 23/24; falla `cs-farmaceutico-direccion` (existía antes del PR 2).
30. **Content-Security-Policy:** probarla contra el login de Google, YouTube y Sentry antes de activarla; a ciegas rompe el sitio.
31. **Certificado de Postgres:** `rejectUnauthorized: false` en `lib/db/index.ts` y `scripts/migrate.mjs`. Arreglarlo de verdad es traer la CA de Railway, no cambiar una línea.
32. **Motor de respuestas:** el vocabulario QF → norma tiene ~40 entradas (cada consulta real que termine en «parcial» o «ausente» es candidata); no detecta contradicciones entre normas que no sean de plazos; «¿Necesito contrato de trabajo…?» (h16) queda «parcial» en vez de «ausente». Una medición limpia exige las preguntas nuevas de los puntos 5–6.
33. **Operación continua** (plan de migración, fase 6), sin evidencia de que esté hecho: monitor externo sobre `/api/health`, entorno de staging con su propia base, alerta de uso de Railway a US$15/mes, probar una restauración del respaldo.
34. **Sección FDA:** calibrar el verde con preguntas reales sobre el 21 CFR validadas por un QF (hoy llega como máximo a «parcial»), glosario español → inglés para poder preguntar en español, sumar la Parte 3 y llevar el bloque `fda` de `estado-corpus.json` a `/api/estado` y al vigía de frescura. Detalle en `cerebro/fda/README.md` § 6.

## 3. Suspendido o decidido no cambiar

| Qué | Decisión | Por qué / cuándo reactivar |
|---|---|---|
| **Planes pagados y packs** (`/planes`: $10.000 y $100.000 al mes, packs de 250 y 1.000 créditos) | **Descartado el 23-09.** Reemplazado el 24-09 por: cada mensaje cuenta 1 de 10 al día, sin devoluciones, y al llegar al tope se ofrece «¿Es urgente? Agenda una evaluación». `/planes` redirige con 308 desde el hotfix. | El código (`lib/planes.ts`, `lib/creditos.ts`, `/admin/planes`, `/admin/clientes`, migraciones 0008–0010) sigue en el repo. |
| **Limpieza del cobro, etapa 2** (borrar tablas y columnas de planes y créditos) | **No se hizo, a propósito.** El plan de fin de semana la sacó del PR de las decisiones del 24-09: «no borres tablas ni columnas; déjala anotada». | Hacerla cuando se confirme que el cobro no vuelve. |
| Pasarela de pago (Flow / Mercado Pago), aviso de vencimiento de suscripción, términos de planes y reembolso, boleta o factura | **Quedan sin efecto** junto con los planes. | Solo reaparecen si se reactiva el cobro. |
| **Guías FDA y Federal Register** | La sección FDA se encendió el 08-10 solo con el 21 CFR (ver §4). Las guías (2.787) y el Federal Register (3.661 reglas) siguen fuera. | Las guías entran con su marca de no vinculante (`cerebro/fda/README.md` § 6). Ojo: la Parte 820 ya es la QMSR (ISO 13485 por referencia). |
| openFDA | Descartado: datos de producto, no texto normativo. | — |
| `reasoning_effort: medium` en gpt-oss | Probado y descartado: +38 % de costo, sin mejora. Se queda `low`. | — |
| Endurecer los umbrales del motor para d15 y d26 | No se tocaron: «parcial» es el estado de 25 de las 39 preguntas respondibles, incluidas casi todas las buenas. Se resolvió con señal automática y prompt. | — |
| Refactor de `lib/search.ts` (989 líneas) | No se toca: riesgo de regresión en el motor sin ganancia funcional. | — |
| `sslDeUrl` duplicada en `.ts` y `.mjs` | Se queda: el aplicador de migraciones corre sin el resolvedor de rutas de Next. | — |
| HSTS con `includeSubDomains` / `preload` | No se pusieron: son difíciles de revertir. | — |
| Regla «dispositivos fuera de alcance» | No se borró: lleva `salvo_categoria` y se apaga sola cuando el corpus trae dispositivos. Borrada, el motor respondía con pasajes ajenos. | — |
| Nombrar al empleador en la trayectoria | **Decidido el 24-09: no se nombra.** Hoy dice «Operador logístico farmacéutico multinacional». | — |
| Tarea de Windows `CerebroRegulatorio-ActualizacionDiaria` | Deshabilitada, no borrada (compite con GitHub Actions). | `Enable-ScheduledTask` si hiciera falta. |
| Proyecto viejo de Vercel `cerebro-regulatorio` | Borrado por Nico; no se recrea. El sitio corre en Railway; el dominio sigue en Vercel solo para DNS. | — |
| Modelo local (Ollama) para la IA | Descartado por el VPS sin memoria. | Si cambia el VPS. |

## 4. Hecho (resumen por fecha)

**Hasta el 10-09 — base.** Migración a Railway, registro con Google y enlace mágico, perfil, panel `/admin`, agenda con Google Calendar y Meet, respaldo de Postgres, Código Sanitario en producción por XML de la BCN (222 artículos, vigilancia por artículo en `registro-cambios/`). Journal de drizzle reparado (`drizzle-kit generate` → «No schema changes»), lint en cero, tarea del Programador deshabilitada, `HEAD.lock` huérfano retirado. Agenda encendida y respaldos corriendo (último 04-10), con lo que quedan cerradas las tareas manuales de ese día (secretos del respaldo, segundo cliente OAuth, publicar la app de Google). Groq quedó configurado.

**11-09 — auditoría del cerebro sin IA.** Una respuesta en vez de seis pasajes (estado en palabras, frase clave, cita corta, avisos). Respuesta visible en las 3 primeras: dev 8/22 → 19/22, holdout 7/17 → 16/17; 0 verdes falsos. Cerrados M1 (frescura cacheada), M2, M3 (tope por norma de 2 a 4), M4 (secretos del respaldo), M5 (HTML sin escapar), m1–m7 (incluida la doble reserva, migración 0004) y o1–o3, o5. o6 (contradicciones) quedó parcial.

**13-09 — modo IA.** Borrador con citas verificadas (`[P2]` lo resuelve el servidor), caché compartida (0005), costo medido: 150 tokens de salida, US$0,00042 por llamada. Prompt v2.

**14-09 — guardas de la IA** (desplegadas en `51e98d4`). Los 14 hallazgos de la auditoría: pregunta saneada y tratada como dato, verificador de cifras y normas nombradas, compuerta de propósito (422 antes del modelo), techo del sitio y ráfaga por persona, ventanas a medianoche de Chile, columnas de señales (0006), `eval-abuso` 20/20 sin falsos positivos, el webhook a n8n ya no manda `usuario_email`. Prompt 14b: cita con evidencia 22/22 en las 41 completas.

**15-09 — buenas prácticas.** Next 16.3.0 con dos RCE → 16.3.5; límite de 5/hora en el formulario de contacto; CSV sin inyección de fórmulas; `timingSafeEqual` en el cron; `fetch` con timeout de 10 s; HSTS y `Permissions-Policy`; URL canónica a `regulamed.cl`; Dockerfile sin `scripts/` salvo `migrate.mjs`; `web-ci.yml` (lint, tipos, pruebas, build, `npm audit`); permisos y timeouts en los workflows.

**22-09 — planes y créditos de IA** (0008–0010): construidos y probados con Postgres real (reserva con candado, libro append-only, proveedor de IA intercambiable desde `/admin/planes`, métricas en `/admin/clientes`, trazabilidad de pagos). **El cobro se descartó al día siguiente** (ver §3); lo reutilizable es el proveedor de IA intercambiable, el libro de movimientos y las métricas.

**01-10 — arreglos del plan de lanzamiento** (rama del PR 2): PR 1 mergeado en la rama; decisiones del 24-09 (1 de 10, voz «nosotros», Producto y Etapa obligatorios, 0011); dispositivos médicos (listado ANDID, DS 825 por XML, DE 25 y 31/2026, 12 doradas `dm-*`); planificación de búsquedas y verificación por afirmación (0012); términos y privacidad nuevos, `/cobertura`, Sentry opcional, `/api/salud`; flujos «Responder una observación del ISP» y «¿Qué trámite necesito?» (apagado salvo `FLUJO_TRAMITE=on`); hilo conversacional, `/historial` (0013), «Te respondo yo en 24 horas hábiles», «Reportar un error». Verificado: tipos, lint, 57/57 pruebas, build, migraciones 0000–0013 sobre Postgres 16 vacío. **No verificado:** calidad real de las respuestas (sin clave del modelo), URL del listado ANDID y corpus de dispositivos (luego corrió «Corpus diario» sobre la rama: verde).

**05-10 — hotfix a producción** (PR 3, `3e07317`; el PR 1 quedó cerrado como mergeado). Arregló `desfaseZona` (los contadores de `rate_limit` volvían a 1 en cada petición: **los topes de uso no se cumplían**), Next 16.3.8 (RCE en `next/og`, GHSA-vcvr-r3jv-pc5j), «World Courier» → operador logístico, `www` y `/planes` con 308, `og:image` de 1200×630, canonical propio en `/agenda`, 404 en español, sitemap de 5 URLs, sin instrucciones internas del video, reintentos en la verificación del ISP. Verificado en `regulamed.cl`. DMARC publicado (`p=none`, informes a `contacto@regulamed.cl`). El enlace del DE 31/2026 subió a la rama del PR 2.

**08-10 — sección EE.UU. (FDA) en el buscador.** Pestaña «Chile · ISP / EE.UU. · FDA» con el 21 CFR (36 partes, 2.346 pasajes, enmiendas al 06-10) en un índice propio: las 78 preguntas de los sets chilenos responden exactamente lo mismo que antes. Compuerta con set dorado FDA (recall@5 21/21, abstención 4/4) y paridad Python/TypeScript en 74 preguntas; si la FDA reprueba, el corpus chileno se publica igual. Aviso «no rige en Chile» fijo en la pestaña y en cada respuesta; la FDA llega como máximo a «parcial»; sin borrador con IA. El pipeline diario baja el 21 CFR y vigila sus cambios (paso 5b). Verificado: tipos, lint, 31 pruebas, build. Detalle en `cerebro/fda/README.md`.

## 5. Datos de referencia

- Aviso de Next: https://github.com/advisories/GHSA-vcvr-r3jv-pc5j
- Decreto Exento 31/2026: Diario Oficial núm. 44.408 del 24-03-2026, https://www.diariooficial.interior.gob.cl/publicaciones/2026/03/24/44408/01/2782631.pdf · LeyChile `idNorma=1222599`.
- Certificados de Railway vigentes hasta el 08-12-2026. Dominio y DNS en Vercel (ALIAS y CNAME a Railway, MX y SPF de ImprovMX, DKIM y envío de Resend).
- Respaldos de ramas en `Claude outputs/*.bundle`.

## 6. Otros documentos que se mantienen (no son listas de pendientes)

- `PRD-cerebro-regulatorio.md` y `PLAN-migracion-railway.md`: diseño y referencia de la migración (costos, variables de entorno, modelo de datos). Las fases 1–5 están hechas; lo que queda de la fase 6 está en el punto 33.
- `Claude outputs/PARCHES-IA-2026-09-14.md`: parches de la auditoría de la IA, ya aplicados.
- `registro-cambios/pendientes.md`: lo regenera `revisar-semanal.js` (normas del ISP sin texto en el corpus). Hoy: ninguna.
- `cerebro/informes/*.md`: los escribe GitHub Actions (informes de las evaluaciones; solo existen en la rama del PR 2).
