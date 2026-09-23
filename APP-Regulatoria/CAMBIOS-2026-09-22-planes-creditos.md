# Planes y créditos de IA — cambios del 22-09-2026

Objetivo: que el costo de la IA no se dispare y que cada plan sea rentable.
Todo lo que decide precios y cupos está en `web/lib/planes.ts`, y `npm test`
falla si un cambio deja un plan con pérdida.

## Modelo acordado con Nico

| | Gratis | Profesional | Director Técnico |
|---|---|---|---|
| Precio mensual (IVA incl.) | $0 | $10.000 | $100.000 |
| Créditos (consultas) al mes | 65 | 2.000 | 40.000 |
| Límite diario | 10 | 150 | 2.000 |
| Personas | 1 | 1 | hasta 10 (cupo compartido) |
| Margen en el peor caso (todo el cupo gastado) | — | 76 % | 52 % |

Packs sin vencimiento: 250 créditos a $2.000 ($8 c/u, margen ~85 %) y 1.000
créditos a $7.000 ($7 c/u, ~83 %). Cuestan más por crédito que el plan
Profesional ($5), para que convenga suscribirse.

- **1 crédito = hasta US$0,001 de costo en el modelo** ($1 con el dólar a
  $1.000). Con gpt-oss-120b una consulta media (~2.500 + 160 tokens) cuesta
  US$0,00047 → 1 crédito. Con un modelo 10× más caro cobraría ~10. (En la
  primera versión era "hasta 5.000 tokens"; se cambió a costo en la segunda
  parte, para que el margen no dependa del proveedor.)
- Supuestos: dólar $1.000, gpt-oss-120b en Groq a US$0,15 / 0,60 por millón,
  IVA 19 %, comisión de pago 3,5 %. El presupuesto usa una consulta "llena"
  de 4.000 + 600 tokens (~$0,96); la real cuesta cerca de la mitad.
- Orden de gasto: primero el plan (vence), después el pack. El pack sirve
  también cuando se agotó el tope **diario** del plan, con un tope propio de
  300 al día (anti-script).
- La caché compartida no cobra: si otra persona ya hizo la misma pregunta con
  los mismos pasajes, la respuesta sale gratis.
- Si la IA falla (error, respuesta vacía, 429 del proveedor, techo del sitio),
  el crédito se devuelve. Antes, un 429 del proveedor costaba una respuesta del
  día.
- El techo del sitio (`LLM_CUOTA_DIARIA_SITIO`, 400/día) ahora aplica **solo al
  plan gratis**: quien paga no queda sin servicio porque las cuentas gratis
  agotaron el día. `LLM_CUOTA_DIARIA` ya no se usa.

## Archivos

| Archivo | Qué |
|---|---|
| `web/lib/planes.ts` | Planes, packs, conversión tokens → créditos, reglas de consumo, márgenes. Puro, sin base. |
| `web/lib/creditos.ts` | Lectura de saldos, reserva/liquidación/reembolso con candado por persona y equipo, acciones del panel, economía del mes. |
| `web/drizzle/0008_planes_creditos.sql` (+ snapshot y journal) | Tablas `suscripciones`, `suscripcion_miembros`, `movimientos_creditos`. Solo crea tablas: se aplica con el servicio arriba. |
| `web/app/api/responder/route.ts` | Cobra créditos en vez de la cuota fija de 20/día. |
| `web/app/api/creditos/route.ts` | GET: saldo de la persona. |
| `web/app/planes/page.tsx` | Página pública de planes. "Contratar" abre WhatsApp con el plan escrito. |
| `web/app/admin/planes/page.tsx` + `web/app/api/admin/planes/route.ts` | Panel: asignar/renovar plan, equipo, cancelar, cargar pack, regalar créditos, y economía real del mes. |
| `web/components/respuesta-ia.tsx` | Muestra el saldo tras cada respuesta y el botón "Ver planes y packs" al agotarse. |
| `web/app/normativa/page.tsx` | Línea de saldo sobre el buscador. |
| `web/components/footer.tsx`, `web/app/sitemap.ts` | Enlace a /planes (no va al menú: una sola CTA por pantalla). |
| `web/tests/planes.test.mts` | 11 pruebas: cupos, márgenes ≥ 50 % / ≥ 75 %, orden plan → pack, topes. |

**El libro es append-only.** `movimientos_creditos` nunca se edita: un
reembolso es otra fila. El saldo de un pack o el uso del mes de un equipo son
sumas, así que un reclamo se contesta mirando filas.

**Carreras.** La reserva toma `pg_advisory_xact_lock` por equipo y por persona.
Probado: 10 reservas simultáneas con 1 crédito de saldo → solo 1 pasa.

## Verificado (en el contenedor, Postgres 16 real)

- `npm run typecheck`, `eslint` de lo tocado, `npm test` (18/18), `next build`.
- `drizzle-kit generate` después de 0008: "No schema changes".
- Migraciones 0000–0008 sobre base vacía.
- Prueba de integración de `lib/creditos.ts`: tope diario gratis, pack que
  permite seguir, consulta larga = 2 créditos, reembolso, concurrencia, plan de
  equipo con cupo compartido, renovación que suma meses, quitar miembro, cambio
  de plan, economía del mes.

## Cómo se opera mientras no haya pasarela de pago

1. La persona entra una vez a regulamed.cl (para que exista su cuenta).
2. Paga (transferencia o link de pago) y avisa por WhatsApp.
3. En `/admin/planes`: "Asignar o renovar plan" con su correo, o "Cargar pack",
   con la referencia del pago en la nota.
4. Director Técnico: agregar a los miembros del equipo por correo.

## Pendiente

- Pasarela de pago (Flow o Mercado Pago) con webhook que llame a `asignarPlan` /
  `cargarPack`. Cuando exista, en `/planes` solo cambia el destino del botón.
- Aviso por correo cuando vence una suscripción.
- Términos y condiciones: agregar planes, packs sin vencimiento y política de
  reembolso.
- Boleta/factura: depende de cómo se facture (persona natural o empresa).


---

# Segunda parte (mismo día): proveedor de IA intercambiable, clientes y trazabilidad

## Cambiar de proveedor de IA sin deploy

- Catálogo `modelos_ia` en `/admin/planes → Modelo de IA`: nombre, URL base
  compatible con OpenAI (Groq, OpenAI, Gemini, Anthropic, DeepSeek, OpenRouter,
  Together…), modelo, precios en US$ por millón y el **nombre** de la variable
  de Railway con la clave. La clave nunca se guarda en la base, y solo se
  aceptan nombres terminados en `_API_KEY` (así el panel no puede mandar
  `BETTER_AUTH_SECRET` a otra URL).
- Flujo: cargar la clave en Railway → agregar el modelo → **Probar** (consulta
  real con la misma búsqueda, prompt y verificación de citas; guarda latencia,
  tokens, costo, créditos por consulta y un extracto) → **Activar**. No se puede
  activar sin prueba OK ni sin clave. Toma efecto en < 30 s.
- Sin modelo activo (o si al activo le falta la clave) responde lo de siempre:
  `LLM_API_KEY / LLM_BASE_URL / LLM_MODEL`. El modelo de hoy quedó en el
  catálogo, **inactivo**, para no cambiar nada al desplegar.
- El cobro se ajusta solo: el crédito es un tope de costo. El panel muestra
  cuántos créditos cobraría cada modelo por consulta media y avisa si con ese
  modelo los planes rinden menos consultas que lo publicado en /planes.
- Cada consulta guarda `proveedor` y `costo_usd` con el precio del modelo que la
  respondió: cambiar de proveedor no reescribe los márgenes pasados. 0009
  calcula el costo de las redacciones anteriores con el precio de gpt-oss-120b.
- `lib/ia/proveedor.ts` sigue sin tocar la base (los scripts de evaluación lo
  importan con Node); la configuración del panel llega como parámetro.

## Clientes y suscripciones (`/admin/clientes`)

- **Métricas:** usuarios, clientes pagos por plan, MRR, ARPU neto, churn 30 d,
  LTV estimado (ARPU × margen ÷ churn), LTV histórico (margen medio de quienes
  pagaron), margen 30 d. Gráfico de 12 meses ingreso neto vs. costo IA, y tabla
  mensual de preguntas, redacciones, créditos, usuarios nuevos y clientes nuevos.
- **Lista:** cada usuario con plan, fecha de registro, fecha de 1ª suscripción,
  preguntas (total y 30 d), redacciones IA, créditos del mes, saldo de pack,
  pagado, costo IA y margen. Búsqueda, filtros por plan y CSV
  (`/api/admin/export?tipo=clientes`).
- **Ficha** (`/admin/clientes/[id]`): saldo, historial de suscripciones con
  alta / vencimiento / fin y motivo, equipo (agregar/quitar), cambiar
  vencimiento, cancelar, asignar/renovar/cambiar plan, cargar pack, regalar
  créditos, registrar pago suelto o devolución; pagos, últimos 100 movimientos
  de créditos y uso mes a mes con gráfico.

## Trazabilidad (0009)

- `pagos`: una fila por pago (bruto con IVA, medio, referencia, fecha real del
  pago, quién lo registró). Asignar plan o cargar pack **registra el pago en la
  misma transacción**; el monto por defecto es el precio de lista × meses y se
  puede cambiar (descuento, cortesía = 0, devolución = negativo).
- `suscripciones.cancelada_en` y `motivo_fin` (`cancelada` | `reemplazada`): un
  cambio de plan no cuenta como baja.
- Definiciones: neto = bruto sin IVA ni comisión; margen = neto − costo IA (no
  incluye Railway); churn 30 d = titulares con plan hace 30 días que hoy no lo
  tienen.
- Límite conocido: el costo IA de un miembro de un equipo Director Técnico se
  imputa a él, y el pago al titular. Para el margen del equipo, sumar ambos.

## Verificado

- Typecheck, eslint, `npm test` (18/18), `next build`, `drizzle-kit generate`
  sin cambios pendientes, migraciones 0000–0009 sobre base vacía.
- Integración con Postgres y un proveedor falso: respaldo a LLM_*, rechazo de
  URL http y de variables que no son `_API_KEY`, no activar sin clave ni sin
  prueba, prueba de punta a punta con el corpus real, activación, cobro de 10
  créditos con un modelo 20× más caro, pagos (con monto, por defecto y
  cortesía), cambio de plan = "reemplazada", baja → churn, métricas, lista,
  ficha y serie mensual.
- Capturas de `/admin/clientes`, la ficha y `/admin/planes` con datos de
  prueba (sesión de admin real contra el build de producción).

---

# Tercera parte: no venderle a quien ya se registró

Regla de Nico: a una persona registrada se le ofrecen los planes **una sola
vez** (al terminar el registro) y después **solo** si llega al límite de su plan.

- **Oferta única** (`components/oferta-inicial.tsx`): la primera vez que entra
  a `/normativa` después de registrarse, y solo si está en el plan gratis, ve un
  modal "Tu cuenta está lista" con los dos planes y "Seguir con el plan gratis".
  Se marca como mostrada apenas aparece (`perfil.planes_ofrecidos_at`, migración
  0010), así que no vuelve a salir aunque cierre la pestaña.
- **Usuarios existentes**: 0010 los marca como ya ofrecidos, porque su registro
  ya pasó. Para anunciarles los planes una vez:
  `UPDATE perfil SET planes_ofrecidos_at = NULL`.
- **Aviso de límite** (`components/modal-planes.tsx`): al chocar con el cupo
  del mes o del día aparece un modal con los planes superiores al suyo y los
  packs. En el tope diario los packs van primero, porque son lo que sirve hoy.
  Quien ya está en Director Técnico solo ve packs. Se abre solo la primera vez
  por límite y día; después queda el mensaje con un botón "Ver opciones para
  seguir".
- **Se quitó** todo lo demás que ofrecía planes con sesión iniciada: el enlace
  "Ver planes" de la línea de saldo del buscador, el botón a `/planes` en los
  avisos de la IA, el "con un plan pagado no hay este tope" del techo del
  sitio (ese es un tope global, no de la persona) y el enlace "Planes de IA"
  del pie de página (sigue visible para quien no tiene sesión). La página
  `/planes` sigue existiendo para visitantes.
- Verificado con el build de producción, Postgres y sesiones reales: modal en la
  1ª visita y no en la 2ª, Esc cierra, marca en la base, pie sin enlace con
  sesión y con enlace sin ella, modal de límite al chocar el tope diario y sin
  reabrirse en el segundo choque del día.
