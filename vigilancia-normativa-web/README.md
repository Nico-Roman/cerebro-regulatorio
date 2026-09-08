# Vigilancia y Repositorio Normativo · ANAMED / ISP Chile

Sitio de 4 páginas, cada una autocontenida (sin servidor):

- **index.html** — portada: KPIs (normas vigiladas, cambios, documentos, revisiones), panorama por categoría, y accesos a cada área.
- **cambios.html** — detalle de cambios detectados vs. la revisión anterior (monitoreo de https://www.ispch.gob.cl/normativa-anamed/, reutiliza los datos de `../vigilancia-isp/`).
- **repositorio.html** — explorador buscable de los 163 PDFs / normas descargadas y catalogadas en `../ANAMED_Normativa/` (fuente: notas de Obsidian en `Obsidian Vault/Asuntos Regulatorios/Normativa ANAMED/`), con enlaces a PDF local, texto OCR (cuando existe) y fuente oficial.
- **historial.html** — historial completo de revisiones del monitoreo.

Cada página trae solo los datos que necesita (la portada trae agregados livianos, no las 170/163 filas completas), así que el sitio queda liviano y navegable sin recargar todo en una sola plana.

## Actualizar y regenerar

```
node ../vigilancia-isp/check-normativa.js   # refresca cambios (opcional si no ha pasado tiempo)
node build.js                                # regenera las 4 páginas
```

Luego abrir `index.html` con doble clic (autocontenido, no requiere servidor) y navegar desde ahí.

Si se agregan normas nuevas al repositorio local, hay que agregar la fila en la nota de categoría correspondiente en Obsidian (como ya se hace hoy) y volver a correr `node build.js`.

## Pendiente antes de publicar en Vercel

Los enlaces "PDF" y "texto OCR" apuntan a rutas **relativas locales** (`../ANAMED_Normativa/...`, ~306 MB en total). Funcionan al abrir el archivo localmente, pero **no van a resolver para nadie más una vez desplegado** a menos que decidamos:

- (a) copiar los PDFs dentro de este proyecto como asset estático y desplegarlos junto con el sitio (aumenta bastante el tamaño del deploy), o
- (b) dejar que en producción esos documentos solo se vean vía el enlace "fuente" (sitio oficial del ISP/BCN), quitando o deshabilitando el link "PDF local" en esa versión.

Decidir esto antes de `vercel deploy`.
