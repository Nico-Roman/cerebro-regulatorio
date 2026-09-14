# Modo IA de RegulaMED — cambios del 13-09-2026

Continúa el informe «RegulaMED — estado de la capa de IA y del VSL · 14-09-2026».
Todo se corrió en el PC (sí tiene `node_modules` y salida a `api.groq.com`), no
en el contenedor. **Nada está commiteado ni desplegado.**

## 1. Pendientes del informe, cerrados

| Pendiente | Resultado |
|---|---|
| Paridad TypeScript ↔ Python | ✅ `eval_respuestas.py`: **idénticos en 49 preguntas**, compuerta aprobada |
| `npm run build` | ✅ aprobado (incluye `/asesoria`); tsc y eslint limpios |
| Salida real del modelo (no se pudo medir) | ✅ medida: **150 tokens de media**, no ~600 |
| Párrafo de la home «No genera respuestas con IA» | ✅ reescrito (ver §4) |
| Marcar la respuesta como borrador a verificar | ✅ «Borrador IA · verifica contra la cita» |
| Caché por pregunta normalizada (palanca 1) | ✅ implementada, migración `0005_ia_cache.sql` |
| `h16-contrato` no se abstenía | ✅ el motor sigue en «parcial», pero **la IA sí se abstiene** |

## 2. Qué es el modo IA

En `/normativa` hay un interruptor **Modo IA**, visible solo si `LLM_API_KEY`
existe. Queda guardado en el navegador. Encendido, cada búsqueda que no sea
«ausente» pide sola un borrador. Apagado, se ve el botón de siempre.

El borrador va **debajo** de la frase de la norma, nunca en su lugar, en un
recuadro punteado con la etiqueta de borrador, la lista de pasajes que citó
(con enlace a la fuente oficial) y el descargo.

### El modelo ya no escribe citas

Antes el modelo copiaba «DS 3 · art. 217 (…)» entre corchetes, y nada impedía
que citara una norma que no estaba en los pasajes. Ahora escribe `[P2]` y el
servidor lo reemplaza por la cita real (`lib/ia/redactar.ts → resolverCitas`).

- Un número fuera de rango queda como «cita no verificable». El borrador se
  muestra con una advertencia en rojo y **no entra a la caché**.
- Un borrador sin ninguna cita también se advierte.
- Se aceptan `[P1, P3]`, `[P2-P4]` y los corchetes `【P2】` que gpt-oss usa por
  costumbre aunque el prompt pida otros (sin esto, la primera prueba salía
  «sin citas»).
- La abstención usa una frase fija: «Los pasajes recuperados no alcanzan para
  responder esta pregunta.». Solo cuenta si abre la respuesta.

### Caché compartida

Clave = sha256(versión del prompt, modelo, pregunta normalizada, cita y texto
de los 6 pasajes). Como el texto de los pasajes forma parte de la clave, una
actualización del corpus que cambie lo recuperado invalida la caché sola. Un
acierto de caché no descuenta cuota y guarda `tokens_in/out = 0`, así que
sumarlos sigue dando el gasto real. Se reparte entre usuarios: los términos lo
dicen.

### Otros

- 429 del proveedor con espera corta → «ocupado, reintenta en N s» con botón.
  Espera larga (> 2 min, el tope diario) → «límite alcanzado por ahora», sin
  reintento.
- `/api/estado` expone `ia.configurada` y `ia.modelo`. Sirve para confirmar
  desde fuera que la variable de Railway se aplicó. No afecta `ok`.
- `LLM_CUOTA_DIARIA` ahora sí se lee (antes estaba fija en 20 en el código).

## 3. Evaluación de la IA — `scripts/eval-ia-local.mjs`

Motor TS real + prompt real + modelo real, sin servidor ni base, sobre
`cerebro/preguntas-reales.json`. Lee la llave de `.env.local` y no la imprime.

```
cd APP-Regulatoria/web
node --experimental-strip-types --no-warnings scripts/eval-ia-local.mjs
```

Aprueba con: cita con evidencia ≥ 90 % (sobre las preguntas donde la evidencia
llegó a los pasajes), abstención 100 % en «fuera», 0 citas inválidas, 0
borradores sin cita.

### Corrida completa, prompt v1 (49 preguntas, 44 llamadas)

| Métrica | Resultado |
|---|---|
| Citas a pasajes inexistentes | **0** |
| Borradores sin cita | **0** |
| Abstención en preguntas fuera de ámbito | **6/6** |
| Cita el pasaje que contiene la evidencia | 22/25 (88 %) |
| Abstención en «sin texto» | 2/4 |
| Tokens entrada / salida / razonamiento (media) | 2.224 / 150 / 38 |
| Latencia mediana | 0,8 s |
| Costo por llamada | **US$0,00042** (la estimación era 0,00067) |
| Costo por consulta, contando la compuerta | US$0,00038 |

### Prompt v2 (vigente, `VERSION_PROMPT = 2026-09-13b`)

Dos reglas nuevas. La abstención es solo si ningún pasaje contiene lo pedido;
si hay una respuesta parcial se da y se dice qué falta, y nunca se mezcla
respuesta con frase de abstención. Además, si los pasajes tratan otro caso o
solo una regla general, hay que decirlo.

- Arregló d03, h03 y h07 (h07 respondía bien y después pegaba la abstención).
- Set dev completo con v2: **15/17** citan evidencia. d07 y d13 se abstienen
  teniendo la evidencia: es conservador, no dañino.
- **Holdout con v2 no medido**: se agotó el tope diario de Groq (§5).
  Repetir mañana con el comando de arriba.

### `reasoning_effort: medium` — probado y descartado

En los 7 casos difíciles: salida 395 tokens (vs 150), razonamiento 292 (vs 38),
**+38 % de costo**, y ninguna mejora. d15 incluso perdió la advertencia que sí
daba con `low`. Se queda `low`.

### Limitaciones conocidas (motor en «parcial», ámbar)

- **d15** (importar sin registro para uso personal): responde con el art. 94
  del DS 3, que trata otro caso. Con v2 agrega que los pasajes «no cubren
  condiciones específicas para uso personal», pero igual lo presenta como la
  respuesta.
- **d26** (sanción por vender falsificados): cita el art. 174 del Código
  Sanitario, que es el régimen general, como si fuera la sanción específica.
  Jurídicamente es defendible; la etiqueta de la pregunta dice que no hay texto.

## 4. Textos públicos cambiados

- **Home**: «Con el modo IA, además redacta un borrador de respuesta que usa
  solo esos pasajes y cita cada uno: la frase de la norma va siempre primero, y
  el borrador se verifica contra ella.» La home es estática y el texto no
  depende de la variable: **poner la llave antes de desplegar este código.**
- **Términos §03**: menciona el modo IA, el envío a un proveedor externo sin
  datos de la cuenta y la reutilización entre usuarios.
- **Privacidad §04**: nombra a **Groq (Estados Unidos)** en vez de «proveedor
  del modelo».

## 5. ⚠️ Decisión antes de encender: el tier gratuito no alcanza para el modo IA

Medido hoy, no estimado. Tras ~80 borradores en una hora, Groq devolvió 429
con esperas de **8 a 27 minutos**: el tope diario de tokens del tier gratuito,
**compartido por todo el sitio**. El tope por minuto (8.000 tokens) se tocaba en
casi cada pregunta seguida.

Con el modo IA pidiendo borradores solos, unas pocas personas activas agotan
el día. A US$0,42 por cada mil borradores, el tier Developer de Groq (pago por
uso) cuesta menos que un café al mes a este volumen. Opciones:

1. **Tier Developer en Groq antes de encender** (recomendado).
2. Encender con tier gratis y el modo IA como botón solamente. Hoy el
   interruptor aparece siempre que haya llave; ocultarlo es una línea.
3. `LLM_MODEL=openai/gpt-oss-20b`: la mitad del costo y más cupo, sin evaluar
   con texto normativo.

## 6. Para encender (orden)

1. Revisar `web/lib/asesoria.ts` palabra por palabra: sigue siendo borrador y
   va en el mismo push (§ informe del VSL).
2. Decidir §5.
3. Railway → `cerebro-regulatorio` → Variables → `LLM_API_KEY` → **Deploy**.
4. Commit + push a `main`. El contenedor aplica `0005_ia_cache.sql` al arrancar
   (solo agrega dos columnas nulas y un índice).
5. `https://regulamed.cl/api/estado` → `ia.configurada: true`.
6. Una búsqueda con modo IA encendido; repetirla desde otra cuenta para ver
   «Reutilizado de una consulta idéntica».
7. A los días: `SELECT sum(tokens_in), sum(tokens_out), count(*) FILTER (WHERE tokens_in = 0) FROM consultas WHERE respuesta_llm IS NOT NULL;`

## Archivos

Nuevos: `web/drizzle/0005_ia_cache.sql`, `web/drizzle/meta/0005_snapshot.json`,
`web/scripts/eval-ia-local.mjs`.
Modificados: `web/lib/ia/redactar.ts`, `web/lib/ia/proveedor.ts`,
`web/app/api/responder/route.ts`, `web/app/api/estado/route.ts`,
`web/components/respuesta-ia.tsx`, `web/components/buscador-normativa.tsx`,
`web/app/normativa/page.tsx`, `web/app/page.tsx`, `web/app/terminos/page.tsx`,
`web/app/privacidad/page.tsx`, `web/lib/db/schema.ts`,
`web/drizzle/meta/_journal.json`, `web/.env.example`.

La base de `.env.local` es la de **producción**: no se levantó el servidor ni se
corrió la migración en local.
