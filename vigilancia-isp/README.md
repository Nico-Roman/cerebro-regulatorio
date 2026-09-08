# Vigilancia Normativa ISP · ANAMED

Monitoreo local de la página oficial de normativa de medicamentos del ISP:
<https://www.ispch.gob.cl/normativa-anamed/>

Cada ejecución descarga la página, la compara con la última captura y regenera
un dashboard HTML con lo que cambió.

## Uso

```
node check-normativa.js
```

Luego abrir `dashboard.html` en el navegador (doble clic). No requiere servidor
ni conexión: el dashboard es autocontenido.

## Qué detecta

- **Nuevas**: normas que aparecen en la página y no estaban en la captura anterior.
- **Modificadas**: mismas normas (categoría + tipo + número) con cambios en
  descripción, fecha, enlace o columna "Modificaciones" — muestra el antes → después
  de cada campo.
- **Eliminadas**: normas que estaban y ya no aparecen.

La primera ejecución establece la línea base (170 normas al 14-07-2026); los
cambios se detectan desde la segunda en adelante.

## Archivos

| Archivo | Qué es |
|---|---|
| `check-normativa.js` | Script de monitoreo (descarga → parseo → diff → dashboard) |
| `template.html` | Plantilla del dashboard (editable; los datos se inyectan al generar) |
| `dashboard.html` | **El dashboard** — generado, no editar a mano |
| `snapshots/latest.json` | Última captura (la referencia para el próximo diff) |
| `snapshots/snapshot-*.json` | Capturas históricas (solo se guardan cuando hubo cambios) |
| `historial.json` | Registro de todas las revisiones ejecutadas |

## Notas

- Si el script reporta menos de 50 normas aborta sin tocar nada: significa que
  el ISP cambió la estructura de la página (habría que ajustar el parser) o que
  la descarga falló.
- Para automatizarlo se puede programar `node check-normativa.js` con el
  Programador de tareas de Windows, o portar la lógica a un workflow de n8n
  (mismo enfoque: descargar HTML → parsear tablas → comparar con snapshot).
