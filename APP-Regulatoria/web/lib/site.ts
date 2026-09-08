// Configuración central de RegulaMED. Todo lo editable de marca vive acá para
// que cambiar un dato (correo, teléfono, un servicio) no obligue a tocar JSX.

export const SITE = {
  nombre: "RegulaMED",
  claim: "Asuntos Regulatorios",
  descripcion:
    "Asesoría en asuntos regulatorios para productos farmacéuticos, cosméticos y dispositivos médicos en Chile. Registro sanitario ISP/ANAMED, farmacovigilancia, tecnovigilancia y cumplimiento normativo.",
  // La URL canónica vive en NEXT_PUBLIC_SITE_URL para que cambiar de dominio
  // sea una variable de entorno y no un commit. El valor por defecto es el
  // sitio actual, para que un entorno sin la variable no quede sin canónica.
  // Ojo con `||` en vez de `??`: en un build de Docker un ARG no pasado deja la
  // variable como cadena vacía, no como undefined, y `new URL("")` revienta el
  // build entero. `||` trata la cadena vacía como ausente.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://cerebro-regulatorio.vercel.app",
  email: "contacto@regulamed.cl",
  // E.164 sin signos para el link de wa.me, y una versión legible para mostrar.
  whatsapp: "56975892545",
  whatsappVisible: "+56 9 7589 2545",
  ciudad: "Santiago",
  region: "Región Metropolitana",
  pais: "CL",
} as const;

export const WHATSAPP_URL = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(
  "Hola RegulaMED, necesito asesoría en asuntos regulatorios."
)}`;

/** Servicios en tarjeta resumen. El índice numerado es parte del diseño. */
export interface Servicio {
  n: string;
  titulo: string;
  descripcion: string;
}

export const SERVICIOS: Servicio[] = [
  {
    n: "01",
    titulo: "Registro sanitario de productos farmacéuticos",
    descripcion:
      "Preparación y presentación del expediente completo ante el ISP, según el DS N°3/2010. Desde la evaluación de factibilidad hasta la resolución de registro.",
  },
  {
    n: "02",
    titulo: "Inscripción de cosméticos",
    descripcion:
      "Registro e inscripción de productos cosméticos ante ANAMED bajo el DS N°239/2002, incluyendo fórmula cuali-cuantitativa, rotulación y claims permitidos.",
  },
  {
    n: "03",
    titulo: "Registro de dispositivos médicos",
    descripcion:
      "Clasificación de riesgo, control sanitario obligatorio y registro de dispositivos médicos y productos de diagnóstico in vitro ante el ISP.",
  },
  {
    n: "04",
    titulo: "Farmacovigilancia",
    descripcion:
      "Diseño e implementación del sistema de farmacovigilancia: notificación de sospechas de RAM, informes periódicos de seguridad y planes de gestión de riesgos.",
  },
  {
    n: "05",
    titulo: "Tecnovigilancia",
    descripcion:
      "Vigilancia post-comercialización de dispositivos médicos: reporte de incidentes adversos, acciones correctivas de seguridad en terreno y trazabilidad.",
  },
  {
    n: "06",
    titulo: "Cambios post-registro",
    descripcion:
      "Gestión de modificaciones al registro sanitario: cambios de fórmula, de sitio de fabricación, de titular, de rotulado y renovaciones antes del vencimiento.",
  },
  {
    n: "07",
    titulo: "Buenas prácticas y auditorías",
    descripcion:
      "Preparación para inspecciones del ISP en BPM, BPA y BPD. Diagnóstico de brechas, planes de acción correctiva y acompañamiento durante la fiscalización.",
  },
  {
    n: "08",
    titulo: "Rotulación y publicidad",
    descripcion:
      "Revisión regulatoria de envases, folletos de información al profesional y material promocional para que cumplan la normativa vigente antes de salir al mercado.",
  },
  {
    n: "09",
    titulo: "Importación y uso provisional",
    descripcion:
      "Autorizaciones de importación, internación de productos sin registro para uso provisional y gestión de destinaciones aduaneras con el ISP.",
  },
  {
    n: "10",
    titulo: "Vigilancia normativa continua",
    descripcion:
      "Monitoreo permanente de la normativa del ISP/ANAMED con alertas de cambios que afectan tus productos, para que ningún plazo de cumplimiento te tome por sorpresa.",
  },
  {
    n: "11",
    titulo: "Documentación y SOPs",
    descripcion:
      "Redacción y estandarización de procedimientos operativos estándar, manuales de calidad y documentación exigida en procesos de certificación.",
  },
  {
    n: "12",
    titulo: "Capacitación regulatoria",
    descripcion:
      "Formación a equipos técnicos, comerciales y de calidad en normativa sanitaria chilena aplicada al día a día de tu operación.",
  },
];

/** Áreas de práctica desarrolladas en profundidad (bloques largos de la home). */
export interface Area {
  clave: string;
  etiqueta: string;
  items: string[];
  titular: string;
  parrafoA: string;
  parrafoB: string;
}

export const AREAS: Area[] = [
  {
    clave: "registro",
    etiqueta: "Registro",
    items: ["Farmacéuticos", "Cosméticos", "Dispositivos médicos", "Diagnóstico in vitro"],
    titular:
      "Llevamos tu producto desde el expediente hasta la resolución de registro del ISP.",
    parrafoA:
      "El registro sanitario es la puerta de entrada al mercado chileno y también donde más tiempo se pierde. Un expediente incompleto, una monografía mal referenciada o una clasificación de riesgo equivocada pueden significar meses de observaciones y respuestas que se podían haber evitado desde el primer envío.",
    parrafoB:
      "Armamos el expediente con la normativa en la mano: DS N°3/2010 para productos farmacéuticos, DS N°239/2002 para cosméticos y el marco de control sanitario para dispositivos médicos. Revisamos cada requisito antes de presentar y respondemos las observaciones de ANAMED contigo, no después de que llegan.",
  },
  {
    clave: "vigilancia",
    etiqueta: "Vigilancia",
    items: ["Farmacovigilancia", "Tecnovigilancia", "Cosmetovigilancia", "Gestión de riesgos"],
    titular:
      "El registro no termina cuando sale la resolución: ahí empieza tu obligación de vigilancia.",
    parrafoA:
      "Todo titular de registro tiene la obligación permanente de detectar, evaluar y notificar los eventos adversos asociados a sus productos. La ausencia de un sistema de vigilancia funcional es uno de los hallazgos más frecuentes en fiscalización, y también uno de los más caros de corregir a contrarreloj.",
    parrafoB:
      "Diseñamos el sistema completo: procedimientos de notificación, plazos de reporte, informes periódicos de seguridad, plan de gestión de riesgos y el rol del profesional responsable. Si ya tienes uno, lo auditamos contra la normativa vigente y te entregamos el plan de cierre de brechas.",
  },
  {
    clave: "cumplimiento",
    etiqueta: "Cumplimiento",
    items: ["BPM · BPA · BPD", "Auditorías", "SOPs y calidad", "Inspecciones ISP"],
    titular:
      "Preparamos tu operación para que la inspección del ISP no sea una emergencia.",
    parrafoA:
      "Las buenas prácticas de manufactura, almacenamiento y distribución no se improvisan la semana antes de que llegue el fiscalizador. Se sostienen en documentación viva, procedimientos que la gente efectivamente usa y evidencia trazable de que el sistema funciona.",
    parrafoB:
      "Hacemos el diagnóstico de brechas contra la norma aplicable, priorizamos los hallazgos por riesgo real y acompañamos la implementación. Redactamos los procedimientos que faltan y te acompañamos durante la inspección y en la respuesta al acta.",
  },
];

/** Preguntas frecuentes: contenido real para el usuario y datos para el schema FAQ. */
export const FAQS = [
  {
    p: "¿Cuánto demora un registro sanitario en Chile?",
    r: "Depende del tipo de producto y de la calidad del expediente presentado. Los plazos legales de tramitación se cuentan desde que el expediente está completo, por lo que la variable que más influye en el tiempo total es cuántas rondas de observaciones se generan. Un expediente bien armado desde el inicio es la única forma real de acortar el proceso.",
  },
  {
    p: "¿Los cosméticos necesitan registro sanitario?",
    r: "Los productos cosméticos están sujetos a control sanitario en Chile y deben inscribirse ante el Instituto de Salud Pública conforme al reglamento vigente. El tipo de trámite y los antecedentes exigidos varían según la categoría del producto y los claims que se declaren en el rotulado.",
  },
  {
    p: "¿Cómo se clasifica un dispositivo médico?",
    r: "La clasificación depende del riesgo asociado al uso previsto del dispositivo. Esa clasificación determina si el producto queda sujeto a control sanitario obligatorio y qué antecedentes técnicos hay que presentar. Clasificar mal al inicio es el error más costoso del proceso, porque obliga a rehacer el expediente completo.",
  },
  {
    p: "¿Qué es la farmacovigilancia y quién está obligado?",
    r: "Es el conjunto de actividades destinadas a detectar, evaluar y prevenir reacciones adversas a los medicamentos. Los titulares de registro sanitario tienen la obligación de mantener un sistema de farmacovigilancia y de notificar al ISP dentro de los plazos que fija la normativa.",
  },
  {
    p: "¿Atienden empresas fuera de Santiago?",
    r: "Sí. El trabajo regulatorio es documental y se coordina de forma remota en todo Chile. Las visitas presenciales se acuerdan cuando el proyecto lo requiere, como en auditorías de planta o acompañamiento en inspecciones.",
  },
] as const;
