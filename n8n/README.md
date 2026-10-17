# Noticias automáticas de regulamed.cl (n8n)

Dos flujos para importar en el n8n del VPS (`corima-n8n…easypanel.host`):

| Archivo | Flujo | Qué hace |
|---|---|---|
| `noticias-regulamed.json` | **RegulaMED · Noticias** | Cada día a las 09:00 (Chile) investiga noticias nuevas y las publica en `/noticias` |
| `alertas-error.json` | **RegulaMED · Alertas de error** | Si el flujo anterior falla, avisa por Telegram con el nodo y el error |

## Cómo funciona

```
Feeds oficiales (ISP noticias, ISP alertas, portada ISP, Minsal, FDA, MedWatch, EMA)
   + búsqueda en medios con Tavily (6 consultas)
        → descarta lo publicado hace más de 3 días, lo que ya está en la web
          y lo que n8n ya juzgó antes
        → abre cada nota (máx. 12 por día) y saca su texto
        → Groq (openai/gpt-oss-120b) decide si es regulatoria y propone
          título, resumen, categoría, ámbito e importancia, SOLO con el texto de la nota
        → «Validar» revisa sin IA: largo, categoría, fecha verificable,
          cada cifra del título/resumen tiene que estar en la nota, no repetida
        → arma data/noticias.json, lo valida entero con las reglas del sitio
        → commit a main por la API de GitHub → Railway despliega
        → aviso por Telegram: publicadas, descartadas con su motivo y fuentes caídas
```

Reglas de diseño (ver `fallas-silenciosas` en la memoria del proyecto):

- **Latido.** Se publica todos los días aunque no haya noticias: `actualizadas` y `revision` cambian en cada corrida. `/api/estado` las expone y el **Vigía de frescura** de GitHub Actions falla (correo) si llevan más de 2 días sin moverse. El vigía corre en GitHub, no en el VPS: si n8n se cae, el testigo no se cae con él.
- **Reconciliación.** Una nota que no se pudo abrir, o que la IA no alcanzó a responder, no se marca como vista: se reintenta al día siguiente. Las juzgadas se anotan solo después de que el commit sale bien.
- **Evidencia.** Cada corrida es un commit con la lista de lo que entró. `git log -- APP-Regulatoria/web/data/noticias.json` es la bitácora; revertir una nota es revertir o editar ese commit.
- **Destacadas.** A lo más una nueva por día, solo si la IA le da importancia 5. El cuadro muestra las tres destacadas más recientes.
- n8n **nunca edita ni borra** las notas existentes; solo agrega. La lista publicada se corta en 60 (git guarda las anteriores).

## Instalación (una vez)

**0. Primero el código de la web.** El flujo lee `APP-Regulatoria/web/data/noticias.json` desde `main`; ese archivo llega con el commit «noticias: datos en data/noticias.json para el flujo de n8n». Hacer push y esperar el deploy antes de probar el flujo.

**1. Token de GitHub (fine-grained, solo este repo).**
GitHub → Settings → Developer settings → Fine-grained tokens → *Generate new token*:
- Repository access: *Only select repositories* → `Nico-Roman/cerebro-regulatorio`
- Permissions → Repository → **Contents: Read and write** (nada más)
- Vencimiento: 1 año (anotar la fecha; cuando venza, el flujo falla y llega la alerta)

**2. Claves.** Groq: console.groq.com → API Keys. Tavily (opcional): app.tavily.com → API key (plan gratuito, 1.000 créditos/mes; el flujo usa ~180).

**3. Credenciales en n8n** (Credentials → Add → *Header Auth*), con estos nombres exactos:

| Nombre | Name | Value |
|---|---|---|
| `GitHub · RegulaMED noticias` | `Authorization` | `Bearer github_pat_…` |
| `Groq · RegulaMED` | `Authorization` | `Bearer gsk_…` |
| `Tavily · RegulaMED` | `Authorization` | `Bearer tvly-…` |

Telegram: usar la credencial del bot que ya existe (o crear una con el token de @BotFather) y poner tu chat ID en los dos nodos «Avisar por Telegram» (reemplazar `REEMPLAZAR_CHAT_ID`).

**4. Importar.** Workflows → *Import from file*: primero `alertas-error.json`, después `noticias-regulamed.json`. Abrir cada nodo con credencial y seleccionarla (n8n no trae las credenciales en el archivo).

**5. Enlazar las alertas.** En «RegulaMED · Noticias» → ⋯ → Settings → *Error workflow* = «RegulaMED · Alertas de error». Activar el flujo de alertas también.

**6. Probar y activar.** *Test workflow* una vez: debe llegar el Telegram y aparecer un commit `chore(noticias): …` en GitHub. Si está bien, activar el flujo (toggle *Active*). La memoria de notas ya juzgadas solo se guarda en las corridas automáticas, así que la primera corrida programada puede volver a evaluar lo de la prueba (no se duplica: lo publicado se reconoce por URL).

## Ajustes frecuentes

- **Agregar una fuente:** nodo «Fuentes», una línea más (RSS o portada HTML con patrón de enlaces).
- **Cambiar las búsquedas en medios:** nodo «Consultas Tavily». Para apagarlas: desactivar «Buscar en Tavily».
- **Ventana, tope diario, largo de la lista:** `CONFIG` al inicio de cualquier nodo de código (es el mismo bloque en todos; cambiarlo en todos).
- **Criterio editorial / tono:** el prompt `SISTEMA` en «Extraer texto».
- **Hora:** nodo «Cada día 09:00» (zona America/Santiago en los ajustes del flujo).
- **Agregar una nota a mano:** editar `data/noticias.json` con `"origen": "manual"`; `npm test` la valida.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| Telegram «Falló … Nodo: Leer noticias.json» con 401/404 | Token vencido o sin permiso *Contents*; o el archivo aún no está en `main` |
| «Publicar en GitHub» 409 | Alguien editó el archivo entre la lectura y el commit. La corrida siguiente lo resuelve sola |
| «Armar archivo: no pasa la validación» | Una regla del sitio cambió y no se copió al nodo. No se publicó nada |
| Descartadas con «la IA no respondió (429)» | Límite de Groq. Se reintentan solas al día siguiente; si pasa seguido, subir el intervalo de «Resumir con IA» |
| «Fuentes con problemas: ISP …» | El ISP cambió el feed o bloqueó al VPS. Las otras fuentes siguen |
| Vigía de frescura en rojo por noticias | El flujo lleva 2+ días sin publicar: revisar ejecuciones en n8n |
