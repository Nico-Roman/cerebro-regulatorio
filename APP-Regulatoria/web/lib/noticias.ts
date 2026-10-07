// Noticias del sector: farmacéuticos, cosméticos, suplementos y dispositivos
// médicos, en Chile y afuera.
//
// Es una selección editorial, no un agregador: cada nota se leyó en su fuente
// antes de entrar y el resumen dice solo lo que dice la fuente. El titular
// enlaza siempre a la nota original, que es donde está la información completa.
//
// CÓMO SE ACTUALIZA
//
//   · Agregar la nota arriba de NOTICIAS, con su fecha de publicación en la
//     fuente (no la fecha en que se agregó acá).
//   · Las tres que van en el cuadro principal llevan `destacada: true`. Si se
//     marcan más de tres, salen las tres más recientes.
//   · Cambiar ACTUALIZADAS al día de la revisión: sale en pantalla.
//   · Preferir la fuente oficial (ISP, Minsal, FDA, EMA) cuando la nota existe
//     ahí; un medio solo cuando la autoridad no publicó nota propia.

export type CategoriaNoticia =
  | "farmaceuticos"
  | "cosmeticos"
  | "suplementos"
  | "dispositivos";

export const CATEGORIAS: Record<CategoriaNoticia, string> = {
  farmaceuticos: "Farmacéuticos",
  cosmeticos: "Cosméticos",
  suplementos: "Suplementos",
  dispositivos: "Dispositivos médicos",
};

export interface Noticia {
  titulo: string;
  /** Una o dos frases. Obligatorio en las destacadas: es lo que se lee en el cuadro. */
  resumen?: string;
  categoria: CategoriaNoticia;
  ambito: "Chile" | "Internacional";
  /** Fecha de publicación en la fuente, ISO. */
  fecha: string;
  fuente: string;
  url: string;
  destacada?: boolean;
}

/** Día de la última revisión de la selección completa. */
export const ACTUALIZADAS = "2026-10-07";

export const NOTICIAS: Noticia[] = [
  {
    titulo:
      "Experto europeo analiza la realidad regulatoria chilena y propone un «roadmap» colaborativo para dispositivos médicos",
    resumen:
      "Konstantin Sipos plantea fortalecer el marco legal chileno alineándolo con los estándares de Europa y Estados Unidos, equilibrando innovación y protección de la salud pública.",
    categoria: "dispositivos",
    ambito: "Chile",
    fecha: "2026-10-07",
    fuente: "ISP",
    url: "https://www.ispch.gob.cl/noticia/experto-europeo-analiza-realidad-regulatoria-de-chile-y-propone-un-roadmap-colaborativo-para-dispositivos-medicos/",
  },
  {
    titulo: "FDA aprueba la primera válvula cardíaca que crece con el niño",
    resumen:
      "La válvula Autus de Edwards Lifesciences se implanta desde unos 13 mm y se amplía con balón hasta 22 mm a medida que el paciente crece. Es la primera aprobada en EE.UU. con velos poliméricos.",
    categoria: "dispositivos",
    ambito: "Internacional",
    fecha: "2026-10-05",
    fuente: "AJMC",
    url: "https://www.ajmc.com/view/fda-approves-first-heart-valve-to-keep-pace-with-children-s-growth",
  },
  {
    titulo:
      "ISP alerta retiro de cinco lotes de metoclopramida 10 mg por una falla de impresión en el envase secundario",
    resumen:
      "El retiro afecta a los lotes J251361, J251365, J251366, K251547 y K251548. El defecto está en la información impresa de la caja, no en el medicamento.",
    categoria: "farmaceuticos",
    ambito: "Chile",
    fecha: "2026-10-03",
    fuente: "El Contraste",
    url: "https://elcontraste.cl/nacional/2026/10/03/alerta-por-medicamento-utilizado-para-tratar-nauseas-y-vomitos-ordenan-retiro-de-estos-cinco-lotes-en-chile/",
  },
  {
    titulo:
      "ISP publica material para implementar el Decreto 25/2026, que incorpora dispositivos médicos al régimen de control sanitario",
    resumen:
      "ANDIM publicó la primera guía oficial del decreto, con ejemplos para que cada empresa determine si sus productos quedan dentro. Los 39 dispositivos y diagnósticos in vitro incorporados deberán tener registro sanitario del ISP para fabricarse, importarse, comercializarse o distribuirse.",
    categoria: "dispositivos",
    ambito: "Chile",
    fecha: "2026-10-02",
    fuente: "ISP",
    url: "https://www.ispch.gob.cl/noticia/isp-publica-material-informativo-para-facilitar-implementacion-del-decreto-25-2026-que-incorpora-dispositivos-medicos-dm-al-regimen-de-control-sanitario/",
    destacada: true,
  },
  {
    titulo:
      "Tratamientos innovadores tardan siete años en obtener cobertura pública en Chile, un 58% más que hace un año",
    resumen:
      "Según el indicador Patient W.A.I.T. 2026 (CIF Chile e IQVIA), el plazo llega a 85 meses, frente a un promedio regional de 68. De 171 terapias oncológicas innovadoras, solo el 10% tiene alguna cobertura pública.",
    categoria: "farmaceuticos",
    ambito: "Chile",
    fecha: "2026-10-01",
    fuente: "Portal Red Salud",
    url: "https://portalredsalud.cl/2026/10/01/tratamientos-innovadores-tardan-siete-anos-en-obtener-cobertura-publica-en-chile-un-58-mas-que-hace-un-ano/",
    destacada: true,
  },
  {
    titulo:
      "ISP aprobó 116 registros oncológicos en 2026, con 12 principios activos que no existían en Chile",
    resumen:
      "Entre enero y el 27 de septiembre, 20 de esos registros corresponden a moléculas nuevas para el país: anticuerpos biespecíficos, terapias dirigidas y conjugados anticuerpo-fármaco para mieloma múltiple, cáncer de mama, pulmón y ovario.",
    categoria: "farmaceuticos",
    ambito: "Chile",
    fecha: "2026-10-01",
    fuente: "ISP",
    url: "https://www.ispch.gob.cl/noticia/el-instituto-de-salud-publica-de-chile-isp-fortalece-los-tratamientos-oncologicos-avanzados-con-la-aprobacion-de-nuevos-registros-sanitarios-en-2026/",
    destacada: true,
  },
  {
    titulo:
      "Directora del ISP representa a Chile en el XV Encuentro de la Red de Autoridades en Medicamentos de Iberoamérica (Red EAMI)",
    categoria: "farmaceuticos",
    ambito: "Chile",
    fecha: "2026-09-25",
    fuente: "ISP",
    url: "https://www.ispch.gob.cl/noticia/directora-del-isp-representa-a-chile-en-el-xv-encuentro-de-la-red-de-autoridades-en-medicamentos-de-iberoamerica-red-eami/",
  },
  {
    titulo:
      "«¡No compres promesas!»: ISP advierte el peligro de los inyectables ilegales para bajar de peso",
    resumen:
      "Las notificaciones de reacciones adversas subieron 44% entre 2025 y 2026; el sistema registra 1.324 sospechas asociadas a semaglutida desde 2020.",
    categoria: "farmaceuticos",
    ambito: "Chile",
    fecha: "2026-09-22",
    fuente: "ISP",
    url: "https://www.ispch.gob.cl/noticia/no-compres-promesas-isp-advierte-el-peligro-de-uso-de-productos-inyectables-ilegales-para-bajar-de-peso/",
  },
  {
    titulo: "El CHMP de la EMA recomienda 12 nuevos medicamentos en su reunión de septiembre",
    resumen: "Además, recomendó extender las indicaciones de otros 11 medicamentos.",
    categoria: "farmaceuticos",
    ambito: "Internacional",
    fecha: "2026-09-18",
    fuente: "EMA",
    url: "https://www.ema.europa.eu/en/news/meeting-highlights-committee-medicinal-products-human-use-chmp-14-17-september-2026",
  },
  {
    titulo:
      "FDA suma tres suplementos a su alerta por adelfa amarilla tóxica, que ya alcanza 33 productos",
    resumen:
      "Se agregaron Easy Forte Natural Fiber y dos productos de tejocote marca Niwali, vendidos en línea.",
    categoria: "suplementos",
    ambito: "Internacional",
    fecha: "2026-09-17",
    fuente: "FDA",
    url: "https://www.fda.gov/food/alerts-advisories-safety-information/fda-issues-warning-about-certain-tejocote-root-supplements-substituted-toxic-yellow-oleander",
  },
  {
    titulo:
      "ISP emite aviso a la comunidad por cosméticos sin registro sanitario, entre ellos los perfumes fraccionados o «decants»",
    categoria: "cosmeticos",
    ambito: "Chile",
    fecha: "2026-09-15",
    fuente: "ISP",
    url: "https://www.ispch.gob.cl/alerta/aviso-a-la-comunidad-productos-cosmeticos-sin-registro-sanitario-aviso-n-02-26/",
  },
  {
    titulo:
      "ISP informa nuevas recomendaciones de seguridad para pacientes en tratamiento con litio",
    categoria: "farmaceuticos",
    ambito: "Chile",
    fecha: "2026-09-11",
    fuente: "ISP",
    url: "https://www.ispch.gob.cl/noticia/isp-informa-sobre-nuevas-recomendaciones-de-seguridad-para-pacientes-en-tratamiento-con-litio/",
  },
  {
    titulo: "Retiro voluntario de cinco series de loratadina solución oral 5 mg/5 mL",
    categoria: "farmaceuticos",
    ambito: "Chile",
    fecha: "2026-09-09",
    fuente: "Sabes.cl",
    url: "https://sabes.cl/2026/09/09/alertan-por-retiro-voluntario-de-medicamento-que-se-utiliza-para-tratar-alergias",
  },
  {
    titulo: "Jefe de ANAMED abordó los desafíos del acceso sostenible a medicamentos en el país",
    categoria: "farmaceuticos",
    ambito: "Chile",
    fecha: "2026-09-08",
    fuente: "ISP",
    url: "https://www.ispch.gob.cl/noticia/jefe-de-anamed-abordo-desafios-sobre-el-acceso-sostenible-a-medicamentos-en-el-pais/",
  },
  {
    titulo:
      "ISP autoriza a Cruz Verde a vender medicamentos de venta directa a través de Mercado Libre",
    categoria: "farmaceuticos",
    ambito: "Chile",
    fecha: "2026-08-28",
    fuente: "Emol",
    url: "https://www.emol.com/noticias/Economia/2026/08/28/1209860/isp-cruz-verde-mercado-libre.html",
  },
];

const porFechaDesc = (a: Noticia, b: Noticia) => b.fecha.localeCompare(a.fecha);

/** Las tres del cuadro principal, de la más reciente a la más antigua. */
export function noticiasDestacadas(): Noticia[] {
  return NOTICIAS.filter((n) => n.destacada).sort(porFechaDesc).slice(0, 3);
}

/** Todos los titulares que no van en el cuadro principal. */
export function titulares(): Noticia[] {
  const destacadas = new Set(noticiasDestacadas());
  return NOTICIAS.filter((n) => !destacadas.has(n)).sort(porFechaDesc);
}

export function fechaNoticia(iso: string, mes: "long" | "short" = "long"): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", {
    day: "numeric",
    month: mes,
    year: "numeric",
  });
}
