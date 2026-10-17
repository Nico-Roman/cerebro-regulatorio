// Filtro de datos de pacientes (encargo D). Corre ANTES de llamar al modelo:
// si el texto pegado trae datos que identifican a una persona y su salud, no se
// procesa y se explica por qué. Términos, sección 05.
//
// Tres señales, todas mecánicas:
//   rut          un RUT con dígito verificador válido (módulo 11). Un número
//                cualquiera con guion no basta: así no se bloquea «Res. Ex.
//                1651-2023».
//   nacimiento   «fecha de nacimiento», «nacido el» o «F. Nac.» seguido de una
//                fecha.
//   nombre       un nombre propio de persona (dos o más palabras con
//                mayúscula, o «paciente»/«Sr.»/«Sra.» seguido de una) a menos de
//                ~80 caracteres de un diagnóstico, un tratamiento o un fármaco.
// Prefiere bloquear de más: el costo de un falso positivo es que la persona
// borre un nombre y vuelva a enviar.
//
// Puro: lo usan las rutas de los flujos, la evaluación y las pruebas.

export type MotivoPaciente = "rut" | "nacimiento" | "nombre_y_salud";

export interface ResultadoPacientes {
  bloquear: boolean;
  motivos: MotivoPaciente[];
  mensaje: string | null;
}

/** Dígito verificador de un RUT chileno (módulo 11). */
export function dvRut(cuerpo: string): string {
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const r = 11 - (suma % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}

/** RUTs con dígito verificador válido que aparecen en el texto. */
export function rutsValidos(texto: string): string[] {
  const salida: string[] = [];
  for (const m of texto.matchAll(/\b(\d{1,2}(?:\.\d{3}){2}|\d{7,8})\s*-\s*([\dkK])\b/g)) {
    const cuerpo = m[1].replace(/\./g, "");
    if (cuerpo.length >= 7 && dvRut(cuerpo) === m[2].toUpperCase()) salida.push(m[0]);
  }
  return salida;
}

const RX_NACIMIENTO =
  /\b(?:fecha\s+de\s+nacimiento|f\.?\s*nac\.?|nacid[oa]\s+el)\s*:?\s*\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/i;

// Términos clínicos que, junto a un nombre, convierten el texto en un dato de
// salud de una persona identificable.
const RX_SALUD =
  /\b(?:diagn[oó]stic\w*|patolog\w*|enfermedad|tratamiento|cuadro\s+cl[ií]nico|ficha\s+cl[ií]nica|hospitaliz\w*|alergi\w*|embaraz\w*|c[aá]ncer|diabetes|hipertensi[oó]n|vih|depresi[oó]n|epilepsia|reacci[oó]n\s+adversa|\d+\s?(?:mg|ml|mcg|ui)\b|dosis|receta(?:do|da)?)\b/i;

// Nombre de persona: «paciente Juan Pérez», «Sra. María», o dos-tres palabras
// con mayúscula seguidas que no son una institución ni una norma.
const RX_NOMBRE = new RegExp(
  [
    String.raw`\b(?:paciente|usuari[oa]|sr\.?|sra\.?|don|doña)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+`,
    String.raw`\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})?\b`,
  ].join("|"),
  "g"
);

// Palabras con mayúscula que no son nombres de persona en una observación del
// ISP: instituciones, documentos, meses, encabezados.
const NO_NOMBRES = new Set(
  (
    "instituto salud publica pública chile ministerio subdepartamento departamento agencia nacional medicamentos " +
    "anamed andid resolucion resolución decreto exento supremo norma tecnica técnica codigo código sanitario ley " +
    "registro sanitario reglamento buenas practicas prácticas manufactura laboratorio farmacia droguería drogueria " +
    "seccion sección unidad direccion dirección santiago region región metropolitana observacion observación " +
    "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre titular expediente " +
    "producto cosmetico cosmético dispositivo medico médico especialidad farmaceutica farmacéutica control calidad " +
    "estudio estabilidad certificado analisis análisis anexo folleto rotulo rótulo informacion información"
  ).split(" ")
);

function esNombrePersona(candidato: string): boolean {
  if (/^(?:paciente|usuari[oa]|sr\.?|sra\.?|don|doña)\s/i.test(candidato)) return true;
  return candidato
    .split(/\s+/)
    .every((p) => !NO_NOMBRES.has(p.toLowerCase()));
}

export function detectarDatosPacientes(texto: string): ResultadoPacientes {
  const motivos: MotivoPaciente[] = [];
  if (rutsValidos(texto).length) motivos.push("rut");
  if (RX_NACIMIENTO.test(texto)) motivos.push("nacimiento");
  for (const m of texto.matchAll(RX_NOMBRE)) {
    if (!esNombrePersona(m[0])) continue;
    const i = m.index ?? 0;
    const entorno = texto.slice(Math.max(0, i - 80), i + m[0].length + 80);
    if (RX_SALUD.test(entorno)) {
      motivos.push("nombre_y_salud");
      break;
    }
  }
  if (!motivos.length) return { bloquear: false, motivos, mensaje: null };
  const que = motivos
    .map((m) => (m === "rut" ? "un RUT" : m === "nacimiento" ? "una fecha de nacimiento" : "un nombre junto a datos de salud"))
    .join(", ");
  return {
    bloquear: true,
    motivos,
    mensaje:
      `El texto parece traer datos de un paciente (${que}). No lo procesamos: los datos de salud de una persona ` +
      "identificable no pueden salir hacia el modelo. Quita nombres, RUT y fechas de nacimiento y vuelve a enviarlo.",
  };
}
