# Guardas de la capa de IA — cambios del 14-09-2026

Cierra la «Auditoría del cerebro con IA · RegulaMED» (14 hallazgos) y aplica
`Claude outputs/PARCHES-IA-2026-09-14.md`. Todo se corrió en el PC.

**Estado de despliegue.** La auditoría se escribió como si la IA estuviera
apagada, pero ya estaba en producción (commit 88f5187). El código de las
guardas **quedó desplegado** dentro del commit `51e98d4` («web: registro corto y
texto simple en la home»), que otra sesión hizo y empujó a las 23:40 con el
working tree completo: `regulamed.cl/privacidad` ya muestra la frase nueva y
`/api/health` responde ok, así que 0006 (y 0007 de esa sesión) se aplicaron.
**Sin commitear** quedan solo las piezas de evaluación y este documento:
`web/scripts/eval-ia-local.mjs`, `web/scripts/eval-abuso.mjs`,
`cerebro/preguntas-abuso.json`, `cerebro/preguntas-reales.json` (campo `caso`),
`web/.env.example`.

## 1. Hallazgos de la auditoría

| ID | Estado | Cómo |
|---|---|---|
| A1 Crítico | ✅ | La pregunta va **al final**, dentro de `<pregunta>`, saneada (`sanearPregunta`), y la regla 0 del prompt la declara dato. Un `--- [P1] Res. Ex. 9999 ---` forjado queda aplanado. |
| A2 Alto | ✅ | `lib/ia/verificar.ts`: todo número del borrador tiene que estar en los pasajes (encabezado incluido). |
| A3 Alto | ✅ | Solo entra a la caché un borrador que pasa todas las verificaciones. |
| A4 Medio | ✅ | Tres piezas, ver §3. |
| A5 Bajo | ✅ | Las señales se leen de las columnas de 0006, no con regex sobre la prosa. La regex queda solo para filas anteriores a 0006. |
| A6 Bajo | ✅ | Normas nombradas en prosa sin número («Reglamento de Farmacias») tienen que estar en un pasaje. |
| B1 Alto | ✅ | `lib/ia/proposito.ts`: compuerta determinista (tarea, rol, formato, clínico) → 422 antes del modelo. |
| B2 Medio | ✅ | Techo del sitio `LLM_CUOTA_DIARIA_SITIO` (400/día). |
| B3 Medio | ✅ | Ráfaga por persona `LLM_CUOTA_MINUTO` (3/min). |
| B4 Bajo | ✅ | `lib/rate-limit.ts`: las ventanas se cortan a medianoche de Chile (con cambio de horario), no a las 21:00. |
| C1 Alto | ✅ | Migración 0006: `abstuvo`, `sin_citas`, `citas_invalidas`, `datos_no_verificados`, `caso_no_cubierto`, `bloqueado`. |
| C2 Medio | ✅ | `cerebro/preguntas-abuso.json` + `scripts/eval-abuso.mjs`. |
| D1 Medio | ✅ | El webhook a n8n ya **no manda `usuario_email`**. Privacidad §03 agrega, sin detalles técnicos: «Llevar un registro de las preguntas que se hacen, con el único fin de mejorar el modelo.» |
| D2 Bajo | ✅ | Verificado por escrito, ver §5. |

## 2. Verificador (`lib/ia/verificar.ts`)

Corrido sobre los 44 borradores reales del 14-09 detectó 4 «cifras sin
respaldo»; **las 4 eran falsos positivos** del verificador del parche, ya
corregidos:

| Caso | Causa | Arreglo |
|---|---|---|
| h03 «466» | el número del DS solo está en el encabezado del pasaje | se verifica contra cita + norma + título + vigencia + texto |
| d07 «1543» | ídem | ídem |
| h01 «10 000» | gpt-oss separa miles con U+202F | se aceptan espacios finos |
| h06 «400» | la ley escribe «cuatrocientas» | parser de números en letras, no tabla |

Además: decimales como una cifra («10,0 %» = 10). Para normas nombradas se
exige que sus palabras significativas estén en un mismo pasaje, no la frase
exacta (el título oficial dice «reglamento del sistema nacional control de
cosméticos», sin «de»; la Ley 20.850 nunca escribe «Ley Ricarte Soto»).

Resultado sobre los mismos 44 textos: **0 falsos positivos**.

## 3. A4 — «responde otra cosa» (d15, d26)

No se tocaron los umbrales del motor: «parcial» es el estado de 25 de las 39
preguntas respondibles, incluidas casi todas las buenas. Endurecerlo mataba
respuestas correctas.

1. **Señal automática `casoNoCubierto`.** `conceptosSinCubrir()` (nuevo en
   `search.ts`, no toca `responder()`) da los conceptos centrales de la pregunta
   que los pasajes **citados** no mencionan. Si el borrador no los reconoce en
   una frase negativa que los nombre, se marca: aviso ámbar y no se cachea.
   Sobre los 44 textos marcó solo d15 («personal»).
2. **Prompt `2026-09-14b`.** Regla 4: identificar el caso concreto; si ningún
   pasaje lo menciona, la primera frase es «Los pasajes no tratan [el caso]
   específicamente;». Regla 3: la abstención no nombra normas ajenas a los
   pasajes.
3. **Etiqueta humana.** `caso` en las 4 preguntas `sin_texto` y métrica
   `respondenOtraCosa` en `eval-ia-local.mjs`, que sí reprueba.

d15 y d26 pasaron a «advierte el caso». La señal automática marcó d05: el
borrador extendió a las «recetas cheque» una regla cuyo pasaje no las nombra.
Es un acierto, por eso se informa y no reprueba.

Nota de d15: el borrador pone la advertencia y después la frase de abstención
en medio del texto. Se muestra como respuesta con advertencia (la abstención
solo cuenta si abre el texto), que es lo correcto.

## 4. Evaluaciones

| Compuerta | Resultado |
|---|---|
| `eval-abuso.mjs` (sin tokens) | ✅ 20/20 bloqueados con el motivo correcto, 0 falsos positivos en 8 limítrofes |
| Compuerta sobre las 73 preguntas reales + doradas | 0 bloqueadas |
| Paridad TS ↔ Python (`eval_respuestas.py`) | ✅ idénticos en 49 |
| `next build`, `tsc`, `eslint` | ✅ |
| `eval-ia-local.mjs`, prompt 14a | ⛔ solo por 4 «cifras sin respaldo», todas falsos positivos (§2). Cita con evidencia 23/25. |
| `eval-ia-local.mjs`, prompt 14b | ver abajo |

### Prompt 14b

El tope diario de Groq cortó la corrida en h12 (8 preguntas con error).
Sobre las 41 completas:

| Métrica | 14a | 14b |
|---|---|---|
| Cita con evidencia | 23/25 | **22/22** |
| Se abstuvo teniendo evidencia | 2 (d04, d07) | **0** |
| `sin_texto` que responden otra cosa | 2 (d15, d26) | **0** |
| Citas inválidas / sin cita | 0 / 0 | 0 / 0 |
| Datos sin respaldo | 4 (falsos positivos) | **0** |
| Caso no cubierto (informativo) | — | 1 (d05, acierto) |
| Tokens entrada / salida (media) | 2.446 / 153 | 2.524 / 159 |
| Costo por llamada | US$0,000459 | US$0,000474 |

Las 8 restantes, reintentadas 20 minutos después: h12 sin alertas; las otras
7 (h16, h17, h18, h19, h20, h22, h24) siguieron topadas. **Falta correrlas
cuando Groq reinicie el día**:

```
node --experimental-strip-types --no-warnings scripts/eval-ia-local.mjs --solo h16-contrato,h17-optica,h18-esavi,h19-farmacia,h20-gondolas,h22-arancel,h24-equivalente-farmaceutico
```

h16 es la única «fuera» de ese grupo; con 14a se abstuvo. Hasta que corran no
hay veredicto completo de la compuerta con 14b.

## 5. D2 — Groq, por escrito

- [Your Data in GroqCloud](https://console.groq.com/docs/your-data): «By
  default, Groq does not retain customer data for inference requests». Solo
  retiene para depurar fallas de fiabilidad, **hasta 30 días**.
- [Services Agreement](https://console.groq.com/docs/legal/services-agreement):
  Groq no puede usar Inputs ni Outputs para entrenar ni ajustar modelos.
- **Zero Data Retention** se activa en *Data Controls* de la consola de Groq y
  elimina también esos 30 días. Recomendado: activarlo antes de encender (es
  un clic, lo haces tú).

## 6. Después del despliegue (orden)

1. ~~Commit + push~~ hecho en `51e98d4`.
2. Verificar en producción: una consulta «redáctame un correo al ISP» con modo
   IA → mensaje de «solo responde preguntas sobre las normas». La caché vieja
   (prompt 13b) deja de usarse sola por el cambio de `VERSION_PROMPT`.
3. Groq: **ZDR** en Data Controls, y decidir el tier Developer (sigue vigente
   §5 del 13-09; hoy la evaluación volvió a toparse con el tope diario).
4. n8n: el flujo del webhook deja de recibir `usuario_email`. Si la planilla
   tenía esa columna, queda vacía; no rompe el flujo.
5. Opcional en Railway: `LLM_CUOTA_MINUTO`, `LLM_CUOTA_DIARIA_SITIO` (por
   defecto 3 y 400).
6. A la semana, la consulta de control:

```sql
SELECT
  count(*)                                                 AS borradores,
  count(*) FILTER (WHERE abstuvo)                          AS se_abstuvo,
  count(*) FILTER (WHERE citas_invalidas)                  AS cita_invalida,
  count(*) FILTER (WHERE sin_citas)                        AS sin_cita,
  count(*) FILTER (WHERE datos_no_verificados IS NOT NULL) AS datos_sin_respaldo,
  count(*) FILTER (WHERE caso_no_cubierto IS NOT NULL)     AS caso_no_cubierto,
  sum(tokens_in), sum(tokens_out),
  count(*) FILTER (WHERE tokens_in = 0)                    AS desde_cache
FROM consultas
WHERE respuesta_llm IS NOT NULL AND created_at > now() - interval '7 days';

SELECT bloqueado, count(*) FROM consultas
WHERE bloqueado IS NOT NULL AND created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 2 DESC;
```

Si `datos_sin_respaldo` sube, el modelo empezó a rellenar. Si `bloqueado`
crece por `tarea`, la gente lo intenta usar como asistente general: decisión de
producto, no bug.

## 7. Lo que queda abierto

- **Paráfrasis inventada sin cifras ni normas** («el titular debe además
  informar al Ministerio»): no la ve ningún verificador mecánico. Exige una
  segunda llamada de fidelidad; a este volumen, por muestreo (1 de cada 20).
- **Registro abierto**: el techo del sitio acota el gasto, no el acceso.

## Archivos

Nuevos: `web/lib/ia/proposito.ts`, `web/lib/ia/verificar.ts`,
`web/drizzle/0006_ia_guardas.sql`, `web/drizzle/meta/0006_snapshot.json`,
`web/scripts/eval-abuso.mjs`, `cerebro/preguntas-abuso.json`.
Modificados: `web/lib/ia/redactar.ts`, `web/app/api/responder/route.ts`,
`web/app/api/search/route.ts`, `web/components/respuesta-ia.tsx`,
`web/lib/db/schema.ts`, `web/lib/rate-limit.ts`, `web/lib/search.ts` (solo
agrega `conceptosSinCubrir`), `web/app/privacidad/page.tsx`,
`web/scripts/eval-ia-local.mjs`, `web/drizzle/meta/_journal.json`,
`web/.env.example`, `cerebro/preguntas-reales.json` (campo `caso`).
