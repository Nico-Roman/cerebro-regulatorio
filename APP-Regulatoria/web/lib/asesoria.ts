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
    lugar: "Santiago, Chile",
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
      "Te hago llegaar una propuesta de acuerdo a tus necesidades, totalmente personalizada a tu caso.",
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
