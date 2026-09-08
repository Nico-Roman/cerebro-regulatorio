# PRD — Cerebro Regulatorio Farmacéutico
**Nombre de trabajo:** RegBrain Chile *(alternativas: NormaFarma, RegulaQF — por definir)*
**Autor:** Nicolás Román Gligo | **Versión:** 0.2 | **Fecha:** Julio 2026
**Estado:** Preguntas clave resueltas — listo para iniciar Fase 0

> **⚠️ Objetivo de negocio en revisión (2026-07-27):** el plan ya no apunta a un SaaS de pago (Sección 9). El usuario decidió liberarlo como programa gratuito de código abierto para posicionarse como referente regulatorio experto en automatización/programación — misma lógica que [[SOP-BRAIN]]. La Sección 1 (resumen ejecutivo) y la 9 (modelo de negocio) de este PRD quedan desactualizadas hasta que se reescriban con este nuevo enfoque.

> **⚠️ Embeddings: postergados a propósito (2026-08-26).** La Sección 6 los da por
> siguiente paso de la indexación. La auditoría del motor mostró que los errores
> que quedan no vienen de que BM25 entienda mal el lenguaje, sino de **metadatos
> mal derivados y de OCR que corrompe cifras**. Sumar re-ranking semántico encima
> de eso produce respuestas equivocadas más convincentes, no mejores. El orden
> correcto es: (1) metadatos desde el listado oficial ✅ hecho, (2) señal de
> confianza y compuerta de calidad ✅ hecho, (3) re-OCR de los documentos
> escaneados ⬅ **siguiente**, (4) recién entonces embeddings.
> Detalle y estado en [`cerebro/README.md`](cerebro/README.md).

---

## 1. Resumen ejecutivo

Plataforma SaaS (web + app conectadas) de inteligencia regulatoria farmacéutica propulsada por IA. Funciona como un "cerebro" consultable en lenguaje natural: el usuario describe su situación ("quiero hacer un cambio post-registro en mi laboratorio", "necesito importar un IMP para un ensayo clínico") y el sistema responde con la normativa aplicable, **citas verificables al texto legal exacto**, resoluciones y casos similares, y referencias comparadas a EMA, FDA, OPS y recomendaciones OMS.

El MVP se centra en el marco regulatorio chileno (ISP) con referencias internacionales como contexto comparativo. La visión de largo plazo es expandirse a LATAM (ANMAT, INVIMA, COFEPRIS, DIGEMID), donde el problema de fragmentación normativa es idéntico y no existe un jugador vertical dominante.

## 2. Problema y oportunidad

**El problema.** La normativa farmacéutica chilena está fragmentada en múltiples fuentes (Código Sanitario, decretos supremos, normas técnicas ISP, resoluciones, circulares, guías) sin un buscador unificado ni semántico. Un profesional RA/QA que necesita responder "¿qué requisitos aplican a X?" debe:
- Saber de antemano qué cuerpo normativo consultar (conocimiento tácito, no accesible a juniors).
- Navegar PDFs y sitios gubernamentales con búsqueda por palabra exacta.
- No tiene forma sistemática de encontrar resoluciones o casos precedentes similares al suyo.
- Cruzar manualmente contra estándares internacionales (EMA/FDA/OMS/ICH) cuando trabaja con multinacionales o exportación.

**Por qué ahora.** Los LLM generalistas (ChatGPT, Claude) responden estas preguntas de forma plausible pero no confiable: alucinan números de normas, citan versiones derogadas y no tienen indexadas las resoluciones ISP. En un dominio donde un error regulatorio cuesta multas, rechazos de registro o retiros de mercado, la confiabilidad con trazabilidad a la fuente es el producto.

**Oportunidad.** No existe en Chile una herramienta vertical de inteligencia regulatoria farmacéutica con IA. Los referentes internacionales (Cortellis Regulatory Intelligence, DIA, Freyr) son caros, en inglés y no cubren la profundidad del marco chileno.

## 3. Objetivos y métricas de éxito

**North Star Metric:** consultas resueltas con cita verificada por usuario activo/semana.

| Objetivo | Métrica | Meta a 6 meses post-lanzamiento |
|---|---|---|
| Adopción | Usuarios registrados | 500 |
| Conversión | Free → pago | ≥ 5% |
| Retención | Usuarios activos mensuales que vuelven al mes siguiente | ≥ 40% |
| Confiabilidad | Respuestas con al menos una cita verificable a fuente | ≥ 95% |
| Ingresos | MRR | Punto de equilibrio operativo |

## 4. Usuarios objetivo

Producto abierto al público amplio del sector farmacéutico, con cuatro perfiles priorizados:

1. **QF de Asuntos Regulatorios / QA en laboratorios y droguerías** — caso de uso: cambios post-registro, registro de productos nuevos, cumplimiento GMP/GDP, respuestas a observaciones del ISP. Es el perfil con mayor disposición a pagar.
2. **Consultores regulatorios independientes** — caso de uso: responder rápido a múltiples clientes con respaldo normativo citado; el producto multiplica su capacidad de facturación.
3. **Importadores, distribuidores y startups de salud** — caso de uso: entender qué necesitan para operar legalmente (registro, autorizaciones, publicidad de medicamentos) sin contratar consultoría desde el día uno.
4. **Estudiantes y academia (QF, diplomados, magíster)** — caso de uso: estudio y referencia. Baja disposición a pagar; alimentan el tier gratuito y el funnel de largo plazo.

## 5. Alcance del MVP

### Incluido (v1)

**Corpus Chile (núcleo):**
- Código Sanitario (DFL N° 725) y leyes sectoriales relevantes (Ley de Fármacos y modificaciones — inventario exacto por confirmar en la fase de levantamiento del corpus).
- DS N° 3/2010 (control de productos farmacéuticos de uso humano) y decretos supremos conexos.
- Normas técnicas y guías ISP: BPM, BPD/BPA, bioequivalencia, estabilidad, farmacovigilancia, ensayos clínicos.
- Resoluciones y circulares ISP (ver sección 6 — riesgo principal de ingesta).

**Corpus internacional (criterio supletorio y comparativo, no exhaustivo):** se utiliza como lineamiento cuando la norma chilena presenta vacíos o ambigüedades, y como vista comparada. La Fase 0 se concentra en Chile; la ingesta internacional es selectiva.
- Guías ICH (Q, S, E, M) — armonización.
- Guidelines EMA seleccionadas y CFR Título 21 / guidances FDA seleccionadas.
- OMS: Technical Report Series (anexos GMP/GDP) y recomendaciones OPS.

**Funcionalidades:**
1. **Búsqueda conversacional (RAG):** pregunta en lenguaje natural → respuesta sintetizada con citas clicables al artículo/sección exacta de la fuente. Toda afirmación normativa debe ser trazable; si no hay fuente en el corpus, el sistema lo declara explícitamente en lugar de inventar.
2. **Casos y resoluciones similares:** dada una consulta, mostrar resoluciones ISP relacionadas con enlace al documento original.
3. **Vista comparada:** para un tema dado, mostrar el requisito chileno junto a la referencia EMA/FDA/OMS equivalente.
4. **Alertas de cambios normativos:** suscripción por tema (ej. bioequivalencia, GMP); notificación cuando el pipeline de vigilancia detecta una norma nueva o modificada.
5. **Historial y espacios de trabajo:** guardar consultas, marcar fuentes, exportar respuesta con citas (PDF).
6. **Cuentas y suscripción:** registro, tiers, pago recurrente (Webpay/Stripe según mercado).

### Excluido del MVP (backlog v2+)
- Otras agencias LATAM (ANMAT, INVIMA, COFEPRIS, DIGEMID) — expansión natural, validada por el análisis previo del entorno argentino.
- Dispositivos médicos y cosméticos (partir solo con medicamentos de uso humano).
- Redacción asistida de dossiers/expedientes.
- API para integraciones de terceros.
- App móvil nativa (el MVP es web responsive; app llega en v2 si la retención lo justifica).

## 6. Datos: fuentes, ingesta y actualización

Esta sección es **el riesgo técnico y el foso competitivo del producto a la vez**.

| Fuente | Disponibilidad | Estrategia de ingesta |
|---|---|---|
| Leyes y decretos | Pública y estructurada (LeyChile/BCN, con API) | Ingesta automatizada + versionado (vigente vs. derogado) |
| Normas técnicas y guías ISP | Pública (PDFs en sitio ISP) | Scraping + parsing PDF + curaduría manual de metadatos |
| Resoluciones ISP | **Resuelto:** corpus 2020–2026 ya scrapeado (normativa vigente reciente, sin cambios estructurales mayores en el período) | Scraper semanal automatizado que detecta resoluciones nuevas y las incorpora al repositorio; backfill histórico pre-2020 bajo demanda si un caso de uso lo justifica |
| EMA / FDA / ICH / OMS | Pública, bien estructurada | Ingesta selectiva del subconjunto comparativo |

**Pipeline de actualización:** reutilizar la arquitectura de vigilancia regulatoria ya diseñada (skill `reg-watch`) como backend de detección de cambios: monitoreo periódico de fuentes → diff → reingesta → alerta a suscriptores. Cadencia semanal para resoluciones ISP (scraper ya definido). El scraper debe incluir monitoreo de fallos y alerta ante ejecuciones vacías o anómalas: un scraper que falla en silencio produce un corpus desactualizado sin que nadie lo note, que es el peor escenario para un producto cuya promesa es la vigencia. Cada documento del corpus lleva metadatos de vigencia, fecha, órgano emisor y jerarquía normativa.

**Regla de oro del corpus:** ningún documento entra al índice sin metadatos de vigencia verificados. Es preferible un corpus más pequeño y confiable que uno grande con normas derogadas mezcladas.

## 7. Requerimientos no funcionales

- **Trazabilidad:** 100% de las afirmaciones normativas con cita a fuente; enlace al documento original siempre visible.
- **Anti-alucinación:** el modelo responde únicamente sobre el corpus recuperado; ante ausencia de fuente, responde "no encontrado en el corpus" y sugiere dónde buscar.
- **Disclaimer legal:** visible en cada respuesta — la plataforma es una herramienta de apoyo a la investigación regulatoria y no constituye asesoría regulatoria ni legal formal. Incluir en T&C y validar redacción con abogado antes del lanzamiento comercial.
- **Privacidad:** las consultas de usuarios pueden contener información confidencial de sus productos/laboratorios; cifrado en tránsito y reposo, no usar consultas de clientes para entrenar modelos, política de retención clara.
- **Desempeño:** respuesta inicial en streaming < 5 s; disponibilidad ≥ 99%.
- **Idioma:** español como idioma principal; fuentes internacionales pueden mostrarse en inglés con resumen en español.

## 8. Arquitectura técnica (alto nivel)

- **Ingesta:** pipelines n8n (self-hosted, ya operativo) para scraping/descarga programada → parsing (PDF → texto estructurado con jerarquía de artículos) → control de calidad.
- **Indexación:** chunking por unidad normativa (artículo/sección, no por tamaño arbitrario) → embeddings + índice léxico (búsqueda híbrida semántica + keyword, crítica en dominio legal donde los números de norma importan).
- **Capa de respuesta:** LLM (API Claude) con RAG y formato de cita obligatorio; re-ranking de resultados; plantillas por tipo de consulta (requisitos, comparación, precedentes).
- **Frontend:** web app responsive (Next.js o similar); backend en VPS existente o infraestructura gestionada según carga.
- **Vigilancia:** cron de `reg-watch` alimentando reingesta y alertas.

*(El detalle de stack se define en un documento técnico aparte; el PRD solo fija los principios: búsqueda híbrida, citas obligatorias, corpus versionado.)*

## 9. Modelo de negocio: SaaS por suscripción

Hipótesis inicial de tiers (a validar con entrevistas y pricing test):

| Tier | Precio ref. (CLP/mes) | Incluye |
|---|---|---|
| **Free** | $0 | 10 consultas/mes, sin alertas ni exportación. Funnel y validación. |
| **Profesional** | ~$25.000–35.000 | Consultas ampliadas, alertas, historial, exportación con citas. |
| **Equipo** | ~$120.000–180.000 (5 asientos) | Todo lo anterior + espacios compartidos, facturación empresa. |

Ancla de valor: una hora de consultoría regulatoria en Chile cuesta más que un mes de suscripción Profesional. Canales iniciales: LinkedIn (marca personal RA + IA ya en construcción), colegios y asociaciones QF, diplomados, boca a boca del gremio.

**Conflicto de interés a resolver:** definir la relación entre el producto y la consultoría personal ("Nicolás Román, asesor farmacéutico externo") — ¿el SaaS canaliza leads hacia consultoría premium para casos complejos? Probable sinergia, pero debe declararse en el modelo.

## 10. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Calidad/completitud del corpus scrapeado 2020–2026 | Medio — el scraping ya está hecho, pero sin auditar | Auditoría de parsing y metadatos en Fase 0; muestreo manual contra el portal ISP; scraper semanal con monitoreo de fallos |
| Alucinaciones / error normativo | Alto — reputacional y potencialmente legal | RAG estricto con cita obligatoria, evaluaciones periódicas con set de preguntas doradas validadas por QF, disclaimer |
| Responsabilidad legal por decisiones de usuarios | Alto | T&C revisados por abogado, disclaimer por respuesta, seguro de responsabilidad si escala |
| Baja disposición a pagar del público amplio | Medio | Free tier para validar; foco comercial en perfiles 1 y 2 (labs y consultores) |
| Cambios normativos no detectados a tiempo | Medio | Pipeline reg-watch con monitoreo redundante y revisión manual mensual |
| Competencia de LLM generalistas mejorando | Medio | El foso es el corpus curado de resoluciones + vigencia verificada + alertas, no el modelo |

## 11. Roadmap propuesto

**Fase 0 — Consolidación del corpus (3–4 semanas):** el scraping de resoluciones ISP 2020–2026 ya está hecho, por lo que la fase se acorta y se enfoca en: (a) auditoría de calidad del corpus scrapeado (parsing correcto, completitud por muestreo, sin duplicados), (b) estructuración de metadatos por documento (vigencia, categoría temática, jerarquía normativa, fecha, enlace a fuente original), (c) inventario legal exhaustivo de Chile con versiones vigentes (leyes, DS, normas técnicas ISP), (d) ingesta selectiva de EMA/FDA como criterio supletorio, y (e) puesta en producción del scraper semanal con monitoreo. *Gate: corpus con metadatos verificados + set de preguntas doradas armado y validado por QF.*

**Fase 1 — MVP cerrado (8–10 semanas):** RAG con citas sobre corpus Chile + subset internacional, web app básica, 15–20 beta testers del gremio (red QF propia). *Gate: ≥ 90% de respuestas correctas en set de preguntas doradas.*

**Fase 2 — Lanzamiento comercial (4 semanas):** suscripciones, alertas, exportación, campaña LinkedIn. *Gate: primeros 20 clientes de pago.*

**Fase 3 — v2:** casos comparados profundizados, primer país LATAM adicional (candidato: Argentina/ANMAT, ya investigado), app móvil según retención.

## 12. Decisiones tomadas y pendientes

**Resueltas (julio 2026):**
1. **Resoluciones ISP:** corpus 2020–2026 ya scrapeado (últimas regulaciones vigentes, sin cambios estructurales mayores en el período). Scraper semanal incorporará resoluciones nuevas de forma continua e incremental.
2. **Rol de EMA/FDA:** criterio supletorio ante vacíos o ambigüedades de la norma chilena, además de vista comparada. Fase 0 se concentra en Chile.
3. **Estructura societaria:** se constituirá una nueva sociedad dedicada al proyecto.

**Pendientes:**
1. **Nombre, marca y dominio:** por adquirir. Verificar disponibilidad de marca en INAPI y de dominio .cl antes de invertir en identidad visual.
2. **Pricing:** validar los rangos propuestos con 10–15 entrevistas a perfiles 1 y 2 antes del lanzamiento comercial.
3. **Cobertura histórica pre-2020:** el scraper solo avanza hacia adelante; definir si algún caso de uso (precedentes de registro antiguos, criterios históricos del ISP) justifica un backfill puntual.
4. **Auditoría del corpus scrapeado:** verificar parsing y completitud del scraping 2020–2026 por muestreo contra el portal ISP (tarea de Fase 0).
5. **Inventario legal exacto:** confirmar lista definitiva de leyes/decretos/normas vigentes con sus versiones (tarea de Fase 0, idealmente cruzada con avances del diplomado).
