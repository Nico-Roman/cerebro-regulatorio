# Estado y pendientes — 10 de septiembre de 2026

Reemplaza a `PENDIENTES-2026-09-09.md`. Aquel documento listaba seis tareas
tuyas; dos ya no lo son, y el «riesgo conocido» que cerraba el archivo está
cerrado.

---

## 1 · Lo que se hizo desde esta terminal

### 1.1 · El repo quedó sincronizado

`git pull --rebase` + `push`. No arrancó a la primera: había un `HEAD.lock` y un
`objects/maintenance.lock` vacíos, del 09-09 a las 10:20, de un git que murió a
media operación. Con esos archivos presentes **cualquier** operación de git
fallaba con «Another git process seems to be running». No había proceso: se
verificó antes de borrarlos.

### 1.2 · La tarea del Programador de tareas está apagada

`CerebroRegulatorio-ActualizacionDiaria` quedó en `Disabled`. Ya no compite con
GitHub Actions ni deja commits vacíos. Está deshabilitada, no borrada: se
vuelve a encender con `Enable-ScheduledTask` si alguna vez hace falta.

### 1.3 · Dos defectos latentes, ninguno visible todavía

**El respaldo de Postgres no declaraba su entorno.** `respaldo-postgres.yml`
nació con el mismo defecto que el 09-09 rompió `resumen-semanal` y dejó a
`vigia-frescura` vigilando la URL equivocada en silencio: un job sin
`environment:` recibe los secretos del entorno **vacíos** y no avisa. El
encabezado además te mandaba a crear los secretos a nivel de repositorio, que
es donde no están los demás. Corregido antes de su primera corrida.

**El journal de drizzle solo conocía la migración `0000`.** Era el «riesgo
conocido» del documento anterior. Se agregaron las entradas `0001`–`0003` y el
snapshot real de `0003`, obtenido generando contra un `out/` vacío. La prueba
de que quedó bien no es el diff: es que `npx drizzle-kit generate` ahora
responde **«No schema changes, nothing to migrate»**, en vez de proponer crear
de nuevo `feedback`, `agenda_config` y `reservas` —tablas que en producción ya
tienen datos.

### 1.4 · El lint quedó en cero

`eslint .` reportaba 3 errores y 4 avisos. Dos eran defectos de render reales:
`feedback-consulta` y `respuesta-ia` se reseteaban con un `useEffect`, lo que
provoca que el widget se pinte con el estado de la búsqueda anterior antes de
corregirse. Ahora se remontan con `key={consultaId}`.

De los dos `window.location.href` del buscador solo se cambió uno, y la
distinción importa: el del **403** pasa a `router.push` porque la sesión es
válida y solo falta el perfil; el del **401** se deja como navegación dura,
porque la sesión acaba de morir y una navegación blanda conserva el layout ya
renderizado —la pantalla de ingreso podría seguir mostrando el encabezado de
sesión iniciada—.

---

## 2 · El Código Sanitario está en producción

Verificado en `regulamed.cl/api/estado`: **133 documentos, 2.823 pasajes**,
versión refundida **2025-09-29**.

No entró como PDF. El resto del corpus son PDF porque el ISP no publica otra
cosa; la BCN sí publica el **texto refundido** en XML estructurado, y eso da
tres cosas que un PDF no da:

1. El artículo **es** un elemento del documento: cero heurística para trocear.
2. La vigencia viene certificada en la fuente, no inferida de un listado aparte.
3. `fechaVersion` **por artículo**, que es lo que permite vigilar cambios con
   granularidad de artículo en vez de «el archivo cambió».

222 artículos en 12 documentos, cada pasaje con enlace profundo al artículo
exacto en la BCN. Lo que preguntaste —recetas— quedó cubierto: el artículo 101
(«la receta es el instrumento privado…»), el 100 (venta bajo receta) y el 129 A
son recuperables y citables.

**Vigilancia.** Corre dentro del pipeline diario, antes de reconstruir el
corpus (si fuera después, el corpus del día se armaría con la ley de ayer). El
rastro queda en `registro-cambios/`: una línea por artículo en `cambios.jsonl`
más un informe legible. Se probó de punta a punta contra un snapshot alterado a
mano: detecta modificados, nuevos, derogados y eliminados. Si la BCN se cae no
voltea el pipeline —el XML queda versionado en el repo, así que el historial de
la ley sale gratis del historial de git—.

**La compuerta se revisó a propósito.** El contra-set de abstención incluye
preguntas sobre dispositivos médicos, y el Código Sanitario los menciona en su
artículo 111 A: existía el riesgo real de convertir una abstención correcta en
una respuesta falsa. No ocurrió. Recall@5 **24/24 = 100%** (8 preguntas doradas
nuevas, `cs-*`), abstención **5/5 = 100%**.

---

## 3 · La sección FDA está preparada, no lanzada

Como pediste: **no está en vivo**, y no lo está por construcción.
`build_corpus.py` no importa nada de `fda/`, y la salida se escribe en
`fda/corpus/`, que no es la carpeta que el pipeline publica. Verificado: el
corpus de producción tiene **0** registros FDA. No hay bandera que se pueda
activar por descuido.

Está en `APP-Regulatoria/cerebro/fda/`, con el inventario completo de fuentes
en su `README.md`. Todas se probaron contra la red, no se listaron de memoria:

| Fuente | Estado | Qué da |
|---|---|---|
| **eCFR** | **ingestado** | 21 CFR consolidado y fechado. 36 de 275 partes curadas, 2.345 pasajes, enmiendas al 2026-09-08 |
| Guías FDA | investigado | 2.787 documentos con metadatos. La pieza grande que falta |
| Federal Register | investigado | 3.661 reglas finales de la FDA |
| openFDA | descartado | Datos de producto, no texto normativo |

Recuperación probada sobre el corpus FDA: §211.22 para la unidad de control de
calidad, §11.50 para firma electrónica, §320.30 para bioequivalencia.

**Un hallazgo que conviene que sepas ya.** La Parte 820 ya **no** es la vieja
*Quality System Regulation*. Desde `89 FR 7523` (2 de febrero de 2024) es la
**Quality Management System Regulation** e incorpora ISO 13485 por referencia;
por eso pasó de decenas de secciones a nueve. Quien cite «21 CFR 820» de
memoria está citando un texto que ya no existe.

**Lo que falta antes de encenderla** está escrito en `fda/README.md`, con los
tres pasos. El primero es agregar preguntas doradas FDA: hoy el corpus chileno
tiene una compuerta que corta la publicación si el recall baja de 90%, y el FDA
no tiene ninguna. Encenderla sin sus preguntas sería saltarse justamente eso.
También hay que decidir cómo se marca que una guía **no es vinculante**, y poner
un aviso de jurisdicción: un pasaje del 21 CFR contestando una pregunta hecha
en Chile es correcto solo si queda clarísimo que no rige acá.

---

# Lo que sigue siendo tuyo

Son cuatro, no seis. Ninguna se puede hacer desde una terminal.

1. **Completar tu perfil** en `/perfil`. Sin eso el buscador no se abre. Uno de
   los campos es un consentimiento sobre tus datos: no lo puede marcar nadie
   más que tú.

2. **Publicar la app de Google.** Verifica `regulamed.cl` en Search Console con
   la misma cuenta —Google no acepta URL de dominios sin verificar— y pega
   `https://regulamed.cl`, `/privacidad` y `/terminos` en la pantalla de
   consentimiento. Publica en producción: en modo prueba el refresh token del
   calendario caduca a los 7 días. No hace falta enviarla a revisión.

3. **Encender la agenda.** Segundo cliente OAuth (redirección
   `http://localhost:5858/callback`), pegar ID y secreto en `.env.local`, correr
   `node --env-file=.env.local scripts/google-auth.mjs` y llevar las tres
   variables a Railway. Requiere un navegador con tu sesión.

4. **Los secretos del respaldo.** `DATABASE_PUBLIC_URL` y `BACKUP_PASSPHRASE`,
   en **Settings → Environments → Production** (no a nivel de repositorio: el
   workflow ya declara `environment: Production`, y ahí es donde viven los
   demás). Esto se intentó y **no se pudo**: el PAT disponible devuelve
   `403 Resource not accessible by personal access token` sobre los secretos de
   entorno. La frase de respaldo va donde guardas tus contraseñas: sin ella el
   respaldo no se abre, que es exactamente el punto.

Groq sigue pendiente: su página dio error al registrarse. Sin `LLM_API_KEY` el
botón de redacción no aparece y el buscador funciona igual.

---

## Verificaciones de esta sesión

| Qué | Resultado |
|---|---|
| `tsc --noEmit` | 0 errores |
| `eslint .` | 0 problemas |
| `next build` | verde |
| Compuerta de calidad | recall 24/24, abstención 5/5 |
| `drizzle-kit generate` | «No schema changes, nothing to migrate» |
| `regulamed.cl/api/estado` | 133 docs · 2.823 pasajes · Código Sanitario 2025-09-29 |
| GitHub Actions | todo en verde |
| Registros FDA en producción | 0 (como corresponde) |
