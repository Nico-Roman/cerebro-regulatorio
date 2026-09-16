// Contenido de la página /asesoria: trayectoria y proceso de trabajo.
//
// Vive aparte de lib/site.ts porque son datos de una sola página y site.ts ya
// carga con la marca, los servicios, las áreas y las FAQ de la home.
//
// REVISAR ANTES DE PUBLICAR: los hitos de trayectoria y las cifras del proceso
// son afirmaciones sobre una persona real en una página comercial. Nada acá
// debería quedar publicado sin que Nico lo confirme palabra por palabra.

export interface Hito {
  periodo: string;
  rol: string;
  lugar: string;
  detalle: string;
}

export const TRAYECTORIA: Hito[] = [
  {
    periodo: "Hoy",
    rol: "Coordinador de Operaciones Logísticas",
    lugar: "World Courier",
    detalle:
      "Coordinación de la cadena de frío y del transporte de productos farmacéuticos y muestras clínicas bajo GDP. Es el lado que casi ningún asesor regulatorio conoce de primera mano: cómo se rompe en la práctica lo que el expediente promete en el papel.",
  },
  {
    periodo: "Hoy",
    rol: "Asesor regulatorio independiente",
    lugar: "RegulaMED",
    detalle:
      "Acompañamiento a laboratorios, importadores y marcas en registro sanitario, farmacovigilancia, tecnovigilancia y preparación para fiscalización del ISP.",
  },
  {
    periodo: "Base",
    rol: "Diplomado en Asuntos Regulatorios Farmacéuticos",
    lugar: "Universidad de Chile",
    detalle:
      "Formación específica en el marco regulatorio chileno y latinoamericano, con foco en registro, propiedad industrial y vigilancia post-comercialización.",
  },
  {
    periodo: "Hoy",
    rol: "Docente",
    lugar: "INACAP",
    detalle:
      "Clases en la carrera de Técnico en Farmacia. Explicarle la norma a alguien que recién entra obliga a entenderla de verdad, no solo a citarla.",
  },
  {
    periodo: "Base",
    rol: "Químico Farmacéutico",
    lugar: "Pontificia Universidad Católica de Chile",
    detalle:
      "Título profesional habilitante. Es el requisito legal para firmar como director técnico y para responder ante el ISP por un producto registrado.",
  },
];

export interface Paso {
  n: string;
  titulo: string;
  detalle: string;
}

export const PROCESO: Paso[] = [
  {
    n: "01",
    titulo: "Primera evaluación, sin costo",
    detalle:
      "En 30 minutos revisamos tu caso. Me cuentas tus ideas y tus dudas, y te digo si puedo ayudarte y cómo. Si no es mi área, te dirijo a quien sí puede.",
  },
  {
    n: "02",
    titulo: "Diagnóstico y propuesta escrita",
    detalle:
      "Te hago llegar una propuesta de acuerdo a tus necesidades, totalmente personalizada a tu caso.",
  },
  {
    n: "03",
    titulo: "Armado y presentación del expediente",
    detalle:
      "Preparo la documentación y la presento ante el ISP. Las observaciones de ANAMED las respondo yo, contigo al tanto, no después de que llegaron.",
  },
  {
    n: "04",
    titulo: "Lo que viene después del registro",
    detalle:
      "Vigilancia, cambios post-registro, renovaciones y alertas de normativa que te afecta. El registro es el comienzo de tus obligaciones, no el final.",
  },
];

/**
 * Lo que la asesoría no es. Decirlo por adelantado filtra a quien viene por
 * otra cosa y ahorra dos reuniones a todo el mundo.
 */
export const LIMITES = [
  "No soy abogado: no litigo ni represento en sumarios sanitarios.",
  "No garantizo la aprobación de un registro. Nadie puede: la resuelve el ISP.",
  "No acelero plazos por vías que no sean un expediente bien armado.",
];

/**
 * Formación acreditable: título profesional, diplomas y cursos de norma
 * técnica.
 *
 * Va debajo del bloque de perfil, en "Quién te va a atender". Antes vivía como
 * una franja delgada de viñetas entre el buscador y la asesoría, pero estos son
 * nombres largos —"Diploma Asuntos Regulatorios Farmacéuticos, Cosméticos y
 * Dispositivos Médicos"— y en línea se leían como un amontonamiento. Debajo del
 * perfil además quedan donde sirven: respaldan a la persona que la sección
 * acaba de presentar, en vez de aparecer antes de que nadie sepa quién es.
 *
 * `detalle` es la casa que la otorga cuando existe —la universidad— y la sigla
 * de la práctica cuando se trata de un curso de norma técnica.
 */
export interface Credencial {
  titulo: string;
  detalle: string;
}

export const CREDENCIALES: Credencial[] = [
  {
    titulo: "Químico Farmacéutico",
    detalle: "Pontificia Universidad Católica de Chile",
  },
  {
    titulo:
      "Diploma Asuntos Regulatorios Farmacéuticos, Cosméticos y Dispositivos Médicos",
    detalle: "Universidad de Chile",
  },
  {
    titulo: "Diploma Ventas y Marketing Farmacéutico y Dispositivos Médicos",
    detalle: "Pontificia Universidad Católica de Chile",
  },
  { titulo: "Curso Norma Técnica 147", detalle: "GSDP" },
  { titulo: "Curso Norma Técnica 127", detalle: "GMP" },
];

/**
 * Número de registro profesional en la Superintendencia de Salud.
 *
 * Vacío por ahora: si se llena, entra como una credencial más al final de la
 * lista. Es el dato que un cliente puede ir a verificar por su cuenta, así
 * que vale más que todas las otras juntas.
 */
export const REGISTRO_PROFESIONAL = "";

/**
 * Quién atiende. Sube a la home lo que hasta ahora vivía solo en /asesoria.
 *
 * En este mercado nadie le compra a una marca: le compra a un químico
 * farmacéutico identificable que responde con su título. Los cuatro
 * competidores chilenos que muestran dueño con nombre y cara (Regula, Clara
 * Valenzuela, Ma Asesorías, Alquimia) son también los que se leen como más
 * establecidos.
 */
export interface Perfil {
  nombre: string;
  rol: string;
  /**
   * Ruta de la foto dentro de /public. Vacía mientras no exista: el bloque se
   * renderiza igual, solo que sin imagen. Una foto de trabajo, mirando a la
   * cámara, sirve más que un retrato de estudio.
   */
  foto: string;
  parrafos: string[];
}

export const PERFIL: Perfil = {
  nombre: "Nicolás Román",
  rol: "Químico Farmacéutico",
  foto: "",
  parrafos: [
    "Trabajo en operaciones logísticas farmacéuticas, hago clases de Técnico en Farmacia en INACAP y curso el Diplomado en Asuntos Regulatorios de la Universidad de Chile. Los expedientes que preparo salen de los dos lados del problema: lo que exige la norma y lo que después hay que sostener en la operación.",
    "No soy abogado y no garantizo aprobaciones, porque las resuelve el ISP. Lo que hago es armar el expediente con la norma en la mano y acompañarte después de que salga la resolución.",
  ],
};
