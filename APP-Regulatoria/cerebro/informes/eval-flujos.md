# Evaluación de los flujos — 2026-10-05

Modelo: `openai/gpt-oss-120b`.

## ¿Qué trámite necesito? — rutas 20/20 como se esperaba

### t01 ✅ ¿Qué tipo de producto es? Medicamento · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? Sí
Ruta: `medicamento-nuevo-con-registro-extranjero` (esperada `medicamento-nuevo-con-registro-extranjero`) · ISP (ANAMED)

(error del proveedor: El proveedor respondió 429: {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t02 ✅ ¿Qué tipo de producto es? Medicamento · ¿Es importado o fabricado en Chile? Fabricado en Chile · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? No
Ruta: `medicamento-nuevo` (esperada `medicamento-nuevo`) · ISP (ANAMED)

(error del proveedor: El proveedor respondió 429: {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t03 ✅ ¿Qué tipo de producto es? Medicamento · ¿Es importado o fabricado en Chile? Importado · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Sin registro · ¿Tiene registro sanitario en otro país? No
Ruta: `medicamento-nuevo` (esperada `medicamento-nuevo`) · ISP (ANAMED)

(error del proveedor: El proveedor respondió 429: {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org)

Nico: ☐ correcta ☐ a corregir ☐ fuera

### t04 ✅ ¿Qué tipo de producto es? Medicamento · ¿Es importado o fabricado en Chile? Fabricado en Chile · ¿Es de uso humano o veterinario? Humano · ¿En qué situación está? Registrado, con cambios · ¿Tiene registro sanitario en otro país? No
Ruta: `medicamento-cambios` (esperada `medicamento-cambios`) · ISP (ANAMED)

Para efectuar el cambio que desea, debe presentar ante el ISP (ANAMED) una solicitud de modificación del registro sanitario, especificando los aspectos que se pretenden alterar (por ejemplo, fórmula, presentación, rotulado, indicaciones terapéuticas, etc.) y acompañar la documentación requerida según lo establecido en el artículo 65 del DS 3, que autoriza al Instituto a aprobar dichas modificaciones mediante resolución [DS 3 · art. 65].

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

El producto que usted fabrica es un producto cosmético, definido como cualquier preparado destinado a aplicación externa al cuerpo humano con fines de embellecimiento o conservación de la piel, sin efecto sistémico [Código Sanitario · art. 106]. Como el producto ya cuenta con registro sanitario en Chile y necesita incorporar cambios, el trámite que corresponde es la **modificación del registro del producto cosmético ante el Instituto de Salud Pública (ISP)** [DS 239 · art. 36]. El ISP, mediante resolución fundada, podrá requerir la actualización de la información del registro conforme a lo establecido en el artículo 13 del reglamento, para reflejar las modificaciones que usted desea efectuar [DS 239 · art. 36]. Los pasajes disponibles no detallan otros trámites adicionales para este caso.

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
