# Evaluación de los flujos — 2026-10-05

Modelo: `openai/gpt-oss-120b`.

## ¿Qué trámite necesito? — rutas 20/20 como se esperaba

### t01 ✅ ¿Qué tipo de producto es? Medicamento · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? Sí
Ruta: `medicamento-nuevo-con-registro-extranjero` (esperada `medicamento-nuevo-con-registro-extranjero`) · ISP (ANAMED)

Para obtener el registro sanitario de la especialidad farmacéutica importada, el titular debe presentar la solicitud ante el Instituto de Salud Pública (ISP) a través del Departamento ANAMED, cumpliendo con los requisitos de composición, especificaciones técnicas, rotulado y buenas prácticas de manufactura; ningún producto podrá distribuirse sin este registro [Código Sanitario · art. 97].  

Si el medicamento ya cuenta con registro sanitario en otro país, el solicitante debe verificar si procede el procedimiento abreviado previsto para estos casos, presentando la documentación que acredite la necesidad imperiosa y cumpliendo la normativa del DS Nº 3/2010, tal como lo establece la normativa para productos huérfanos y abreviados [Res. Ex. 411 · pág. 2].  

En cuanto a las autorizaciones de importación que correspondan para un producto de uso humano importado, los pasajes disponibles no detallan este trámite, por lo que se deberá consultar la normativa específica de importación sanitaria.  

Finalmente, una vez aprobado el registro, el titular podrá solicitar al ISP la emisión del Certificado de Producto Farmacéutico, el cual debe ser entregado dentro de los diez días siguientes a la recepción de la solicitud [DS 3 · art. 104].

> Afirmaciones sin cita: 2

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t02 ✅ ¿Qué tipo de producto es? Medicamento · ¿Es importado o fabricado en Chile? Fabricado en Chile · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? No
Ruta: `medicamento-nuevo` (esperada `medicamento-nuevo`) · ISP (ANAMED)

Para obtener el registro sanitario de la especialidad farmacéutica fabricada en Chile, el titular debe presentar la solicitud ante el Instituto de Salud Pública (ISP‑ANAMED) con la documentación requerida; el Instituto llevará el registro y sólo podrá distribuir el producto una vez que éste haya sido registrado conforme al art. 97 del Código Sanitario [Código Sanitario · art. 97].  

Si la evaluación de la solicitud y de los antecedentes técnicos resulta favorable, el ISP otorgará el registro sanitario mediante resolución dentro del plazo de seis meses contados desde el pago del arancel correspondiente [DS 3 · art. 47].  

Una vez concedido el registro, el titular debe completar los antecedentes de estabilidad del producto, presentando estudios de estabilidad (en lotes industriales o mediante metodologías matricial/bracketing según corresponda) dentro del plazo y bajo los lineamientos establecidos en la Guía de estabilidad del DS 29/2012 [Res. Ex. 411 · pág. 2].  

Los trámites de autorización de importación no son aplicables, pues el producto se fabrica en Chile; los pasajes no detallan este trámite [los pasajes no detallan este trámite].

> Afirmaciones sin cita: 1

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t03 ✅ ¿Qué tipo de producto es? Medicamento · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? No
Ruta: `medicamento-nuevo` (esperada `medicamento-nuevo`) · ISP (ANAMED)

(error del proveedor: El proveedor respondió 429: {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t04 ✅ ¿Qué tipo de producto es? Medicamento · ¿Es importado o fabricado en Chile? Fabricado en Chile · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Registrado, con cambios · ¿Tiene registro sanitario en otro país? No
Ruta: `medicamento-cambios` (esperada `medicamento-cambios`) · ISP (ANAMED)

Para efectuar el cambio que desea implementar, debe presentar ante el Instituto de Salud Pública (ISP‑ANAMED) una **solicitud de modificación del registro sanitario** del medicamento, acompañada de la documentación que respalde la alteración que se pretende (por ejemplo, cambios en la fórmula, presentación, envase, indicaciones terapéuticas, etc.) [DS 3 · art. 65]. Esta solicitud será evaluada mediante resolución del Instituto, que autorizará la modificación siempre que no altere la naturaleza e identidad de la especialidad farmacéutica (es decir, que no modifique el principio activo, su dosis, forma farmacéutica o sistema de liberación) [DS 3 · art. 65]. En caso de que la modificación implique alguno de esos elementos, el Instituto requerirá un nuevo registro sanitario y no será suficiente la simple modificación [DS 3 · art. 65].

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t05 ✅ ¿Qué tipo de producto es? Medicamento · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Registrado y vigente · ¿Tiene registro sanitario en otro país? Sí
Ruta: `medicamento-vigente` (esperada `medicamento-vigente`) · ISP (ANAMED)

(error del proveedor: El proveedor respondió 429: {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t06 ✅ ¿Qué tipo de producto es? Medicamento · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Veterinario · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? Sí
Ruta: `veterinario` (esperada `veterinario`) · SAG

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t07 ✅ ¿Qué tipo de producto es? Cosmético · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? Sí
Ruta: `cosmetico-nuevo` (esperada `cosmetico-nuevo`) · ISP

(error del proveedor: El proveedor respondió 429: {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t08 ✅ ¿Qué tipo de producto es? Cosmético · ¿Es importado o fabricado en Chile? Fabricado en Chile · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? No
Ruta: `cosmetico-nuevo` (esperada `cosmetico-nuevo`) · ISP

(error del proveedor: El proveedor respondió 429: {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t09 ✅ ¿Qué tipo de producto es? Cosmético · ¿Es importado o fabricado en Chile? Fabricado en Chile · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Registrado, con cambios · ¿Tiene registro sanitario en otro país? No
Ruta: `cosmetico-cambios` (esperada `cosmetico-cambios`) · ISP

El producto que usted fabrica es un **producto cosmético**, entendido como cualquier preparado destinado a aplicación externa al cuerpo humano con fines de embellecimiento o conservación de la piel, sin efecto sistémico [Código Sanitario · art. 106]. Como el producto ya cuenta con registro sanitario en Chile y necesita incorporar cambios, el trámite que corresponde es la **modificación del registro del producto cosmético ante el Instituto de Salud Pública (ISP)**. El ISP, por resolución fundada, está facultado para requerir la modificación del registro cuando se presenten alteraciones en la fórmula o en la información declarada [DS 239 · art. 36]. Si la modificación implica una variación de la composición que no haya sido declarada previamente, podría considerarse un producto adulterado, pero en este caso el trámite se limita a la actualización del registro conforme a lo dispuesto por el ISP [DS 239 · art. 7]. Los pasajes no detallan otros requisitos específicos ni plazos para este procedimiento.

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t10 ✅ ¿Qué tipo de producto es? Cosmético · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Registrado y vigente · ¿Tiene registro sanitario en otro país? No
Ruta: `cosmetico-vigente` (esperada `cosmetico-vigente`) · ISP

(error del proveedor: El proveedor respondió 429: {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t11 ✅ ¿Qué tipo de producto es? Dispositivo médico · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? Sí
Ruta: `dispositivo-nuevo` (esperada `dispositivo-nuevo`) · ISP (ANDID)

(error del proveedor: El proveedor respondió 429: {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t12 ✅ ¿Qué tipo de producto es? Dispositivo médico · ¿Es importado o fabricado en Chile? Fabricado en Chile · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? No
Ruta: `dispositivo-nuevo` (esperada `dispositivo-nuevo`) · ISP (ANDID)

(error del proveedor: El proveedor respondió 429: {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t13 ✅ ¿Qué tipo de producto es? Dispositivo médico · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Registrado, con cambios · ¿Tiene registro sanitario en otro país? Sí
Ruta: `dispositivo-cambios` (esperada `dispositivo-cambios`) · ISP (ANDID)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t14 ✅ ¿Qué tipo de producto es? Dispositivo médico · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Registrado y vigente · ¿Tiene registro sanitario en otro país? Sí
Ruta: `dispositivo-vigente` (esperada `dispositivo-vigente`) · ISP (ANDID)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t15 ✅ ¿Qué tipo de producto es? Suplemento o alimento · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? Sí
Ruta: `suplemento-alimento` (esperada `suplemento-alimento`) · SEREMI de Salud

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t16 ✅ ¿Qué tipo de producto es? Suplemento o alimento · ¿Es importado o fabricado en Chile? Fabricado en Chile · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Registrado y vigente · ¿Tiene registro sanitario en otro país? No
Ruta: `suplemento-alimento` (esperada `suplemento-alimento`) · SEREMI de Salud

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t17 ✅ ¿Qué tipo de producto es? Otro · ¿Es importado o fabricado en Chile? Fabricado en Chile · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? No
Ruta: `otro` (esperada `otro`) · ISP

(error del proveedor: El proveedor respondió 429: {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t18 ✅ ¿Qué tipo de producto es? Otro · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Veterinario · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? No
Ruta: `veterinario` (esperada `veterinario`) · SAG

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t19 ✅ ¿Qué tipo de producto es? Cosmético · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Veterinario · ¿En qué situación está? Registrado y vigente · ¿Tiene registro sanitario en otro país? No
Ruta: `veterinario` (esperada `veterinario`) · SAG

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t20 ✅ ¿Qué tipo de producto es? Dispositivo médico · ¿Es importado o fabricado en Chile? Fabricado en Chile · ¿Es de uso humano o veterinario? Veterinario · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? No
Ruta: `veterinario` (esperada `veterinario`) · SAG

Nico: ☐ correcta ☐ a corregir ☐ fuera

## Rutas por validar (13/13)

- `veterinario`
- `suplemento-alimento`
- `otro`
- `medicamento-nuevo-con-registro-extranjero`
- `medicamento-nuevo`
- `medicamento-cambios`
- `medicamento-vigente`
- `cosmetico-nuevo`
- `cosmetico-cambios`
- `cosmetico-vigente`
- `dispositivo-nuevo`
- `dispositivo-cambios`
- `dispositivo-vigente`

## Observaciones del ISP — 0 con texto de 20
