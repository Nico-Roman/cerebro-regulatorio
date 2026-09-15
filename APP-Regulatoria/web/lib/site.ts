// Configuración central de RegulaMED. Todo lo editable de marca vive acá para
// que cambiar un dato (correo, teléfono, un servicio) no obligue a tocar JSX.

export const SITE = {
  nombre: "RegulaMED",
  claim: "Asuntos Regulatorios",
  descripcion:
    "Asesoría en asuntos regulatorios para productos farmacéuticos, cosméticos y dispositivos médicos en Chile. Registro sanitario ISP/ANAMED, farmacovigilancia, tecnovigilancia y cumplimiento normativo.",
  // La URL canónica vive en NEXT_PUBLIC_SITE_URL para que cambiar de dominio
  // sea una variable de entorno y no un commit. El valor por defecto es el
  // dominio real: si el build de Docker se hace sin el ARG, las canónicas, el
  // sitemap y los enlaces de los correos igual apuntan a donde vive el sitio.
  // Apuntaba al viejo despliegue de Vercel, que ya no existe: un enlace de
  // cancelación de reunión hacia ese dominio no lleva a ninguna parte.
  //
  // Ojo con `||` en vez de `??`: en un build de Docker un ARG no pasado deja la
  // variable como cadena vacía, no como undefined, y `new URL("")` revienta el
  // build entero. `||` trata la cadena vacía como ausente.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://regulamed.cl",
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
    titulo: "Registro de medicamentos",
    descripcion:
      "Armamos y presentamos el expediente completo ante el ISP: desde ver si el producto es viable hasta que sale la resolución.",
  },
  {
    n: "02",
    titulo: "Inscripción de cosméticos",
    descripcion:
      "Inscribimos tu cosmético ante el ISP: fórmula, rotulado y qué se puede y qué no se puede prometer en el envase.",
  },
  {
    n: "03",
    titulo: "Registro de dispositivos médicos",
    descripcion:
      "Definimos en qué clase de riesgo cae tu dispositivo, si necesita registro y armamos la presentación ante el ISP.",
  },
  {
    n: "04",
    titulo: "Farmacovigilancia",
    descripcion:
      "Montamos el sistema para detectar y reportar las reacciones adversas de tus productos, dentro de los plazos que exige el ISP.",
  },
  {
    n: "05",
    titulo: "Tecnovigilancia",
    descripcion:
      "Lo mismo para dispositivos médicos: reportar incidentes, hacer los avisos de seguridad y dejar todo trazable.",
  },
  {
    n: "06",
    titulo: "Cambios post-registro",
    descripcion:
      "Cambiaste la fórmula, la planta, el titular o el envase: gestionamos la modificación y la renovación antes de que se venza.",
  },
  {
    n: "07",
    titulo: "Buenas prácticas y auditorías",
    descripcion:
      "Te preparamos para la inspección del ISP: vemos qué falta, lo ordenamos por urgencia y te acompañamos el día que llegan.",
  },
  {
    n: "08",
    titulo: "Rotulación y publicidad",
    descripcion:
      "Revisamos envases, folletos y material promocional antes de que salgan, para que no te los objeten después.",
  },
  {
    n: "09",
    titulo: "Importación y uso provisional",
    descripcion:
      "Permisos de importación, ingreso de productos sin registro para uso provisional y los trámites de aduana con el ISP.",
  },
  {
    n: "10",
    titulo: "Vigilancia normativa continua",
    descripcion:
      "Revisamos la normativa del ISP todas las semanas y te avisamos cuando cambia algo que afecta a tus productos.",
  },
  {
    n: "11",
    titulo: "Procedimientos y documentación",
    descripcion:
      "Escribimos los procedimientos, manuales de calidad y documentos que te van a pedir en una certificación.",
  },
  {
    n: "12",
    titulo: "Capacitación",
    descripcion:
      "Formamos a tu equipo técnico, comercial y de calidad en la normativa que usan en el día a día.",
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

// Los tres bloques están escritos para alguien que conoce el rubro pero no se
// dedica a lo regulatorio: dueño de una marca, gerente comercial, jefe de
// operaciones. Por eso no llevan número de decreto ni sigla sin explicar — el
// que quiere la referencia exacta la busca en el buscador, que está arriba.
export const AREAS: Area[] = [
  {
    clave: "registro",
    etiqueta: "Registro",
    items: ["Medicamentos", "Cosméticos", "Dispositivos médicos", "Diagnóstico in vitro"],
    titular:
      "Llevamos tu producto desde el papeleo hasta la resolución del ISP.",
    parrafoA:
      "El registro es la puerta de entrada al mercado chileno y también donde más tiempo se pierde. Un expediente incompleto o un producto mal clasificado se traduce en meses de idas y vueltas con el ISP que se podían haber evitado en el primer envío.",
    parrafoB:
      "Armamos el expediente con la norma en la mano, revisamos cada requisito antes de presentar y, cuando llegan observaciones, las respondemos contigo dentro del plazo en vez de avisarte cuando ya se venció.",
  },
  {
    clave: "vigilancia",
    etiqueta: "Vigilancia",
    items: ["Farmacovigilancia", "Tecnovigilancia", "Cosmetovigilancia", "Gestión de riesgos"],
    titular:
      "El registro no termina cuando sale la resolución: ahí parte tu obligación de vigilar el producto.",
    parrafoA:
      "Si tienes un registro, estás obligado a detectar, evaluar y avisarle al ISP de los efectos adversos de tus productos. No tener ese sistema andando es uno de los hallazgos más comunes en fiscalización, y uno de los más caros de arreglar a última hora.",
    parrafoB:
      "Te montamos el sistema completo: cómo se notifica, en qué plazos, qué informes hay que mandar y quién es el responsable. Si ya tienes uno, lo revisamos contra la norma vigente y te entregamos la lista de lo que falta.",
  },
  {
    clave: "cumplimiento",
    etiqueta: "Cumplimiento",
    items: ["Buenas prácticas", "Auditorías", "Procedimientos", "Inspecciones ISP"],
    titular:
      "Preparamos tu operación para que la inspección del ISP no sea una emergencia.",
    parrafoA:
      "Las buenas prácticas de fabricación, almacenamiento y distribución no se improvisan la semana antes de que llegue el fiscalizador. Se sostienen en procedimientos que la gente de verdad usa y en evidencia de que el sistema funciona.",
    parrafoB:
      "Vemos qué te falta frente a la norma que te aplica, ordenamos los hallazgos por riesgo real y te acompañamos a cerrarlos. Escribimos los procedimientos que faltan y estamos contigo el día de la inspección y en la respuesta al acta.",
  },
];

/** Preguntas frecuentes: contenido real para el usuario y datos para el schema FAQ. */
export const FAQS = [
  {
    p: "¿Cuánto demora un registro sanitario en Chile?",
    r: "Depende del producto y, sobre todo, de cómo llegue el expediente. El plazo legal empieza a correr recién cuando está completo, así que lo que más alarga el total son las rondas de observaciones. Presentar bien a la primera es la única forma real de acortarlo.",
  },
  {
    p: "¿Los cosméticos necesitan registro sanitario?",
    r: "Sí: los cosméticos se controlan en Chile y hay que inscribirlos en el Instituto de Salud Pública. Qué trámite corresponde y qué antecedentes piden depende del tipo de producto y de lo que prometa el envase.",
  },
  {
    p: "¿Cómo se clasifica un dispositivo médico?",
    r: "Según el riesgo del uso que se le va a dar. Esa clase decide si el producto necesita registro y qué antecedentes técnicos hay que presentar. Clasificarlo mal al principio es el error más caro del proceso: obliga a rehacer el expediente entero.",
  },
  {
    p: "¿Qué es la farmacovigilancia y quién está obligado?",
    r: "Es vigilar los efectos adversos de los medicamentos una vez que ya están en el mercado. Le toca a todo el que tiene un registro sanitario: hay que mantener el sistema funcionando y avisarle al ISP dentro de los plazos que fija la norma.",
  },
  {
    p: "¿Atienden empresas fuera de Santiago?",
    r: "Sí. El trabajo regulatorio es de documentos y se coordina a distancia en todo Chile. Vamos presencialmente cuando el proyecto lo pide, como en una auditoría de planta o el día de una inspección.",
  },
] as const;
