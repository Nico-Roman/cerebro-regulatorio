// Guías de trámites: el motor de tráfico que el sitio no tenía.
//
// Hasta el 15-09-2026 el sitemap tenía seis URLs y ninguna apuntaba a una
// búsqueda de trámite, así que todo el tráfico dependía de que alguien ya
// conociera la marca. Alrededor de "clave GICONA" —la credencial del sistema en
// línea del ISP— hay dominios chilenos de coincidencia exacta (gicona.cl,
// registroisp.cl, ispregistro.cl, serviciosisp.cl) peleando ese término, y
// consultoras establecidas con páginas dedicadas. Una página por trámite es la
// forma de entrar a esa conversación.
//
// ─────────────────────────────────────────────────────────────────────────────
// CÓMO SE PUBLICA UNA GUÍA
//
// Las cuatro nacen con `publicada: false` y en ese estado no existen para
// nadie: no salen en /guias, no salen en la home, no entran al sitemap y su URL
// responde 404. Eso es deliberado, y sigue siendo cierto para las cuatro.
//
// Estado al 16-09-2026:
//
//   · cosméticos y renovación  → cuerpo normativo REDACTADO, sin publicar.
//     Escrito contra el texto de los decretos que están en el corpus local
//     (web/data/corpus.jsonl, snapshot del listado oficial ISP del 15-09-2026),
//     citando artículo por artículo. Falta que lo leas tú, que agregues el
//     arancel vigente —que no está en el corpus— y que cambies `publicada`.
//
//   · GICONA y dispositivos médicos → solo el encuadre, sin cuerpo.
//     El corpus no cubre ninguno de los dos (7 y 4 menciones sueltas), y las
//     fuentes oficiales bloquean el acceso automatizado. Escribirlos de memoria
//     sería inventar.
//
// La regla no cambia: son afirmaciones regulatorias publicadas bajo tu nombre y
// tu título profesional en una página comercial. Una cifra mal copiada acá no
// es un bug, es un problema tuyo con un cliente. Lee cada sección contra la
// fuente antes de cambiar `publicada` a true.
//
// El estándar de la casa es el mismo del buscador: el dato exacto, con el
// enlace al documento oficial, sin interpretación de más.
// ─────────────────────────────────────────────────────────────────────────────

export interface SeccionGuia {
  h: string;
  p: string[];
}

export interface Guia {
  /** Parte de la URL: /guias/<slug>. No cambiarlo una vez publicado. */
  slug: string;
  /** H1 de la página y base del <title>. Escrito como lo buscaría un cliente. */
  titulo: string;
  /** Bajada: sale en la tarjeta del índice y como meta description. */
  resumen: string;
  /** Fecha de la última revisión, en formato ISO. Sale en pantalla. */
  actualizada: string;
  fuenteOficial: { etiqueta: string; url: string } | null;
  publicada: boolean;
  secciones: SeccionGuia[];
}

export const GUIAS: Guia[] = [
  {
    slug: "obtener-clave-gicona-isp",
    titulo: "Cómo obtener la clave GICONA del ISP",
    resumen:
      "Qué es la clave GICONA, quién la necesita y qué hay que tener listo antes de pedirla al Instituto de Salud Pública.",
    actualizada: "2026-09-16",
    fuenteOficial: {
      etiqueta: "ISP — Integración al sistema (obtención de clave GICONA)",
      url: "https://www.ispch.gob.cl/anamed/importacion-y-exportacion/exportacion/integracion-al-sistema/",
    },
    publicada: false,
    secciones: [
      {
        h: "Para quién es esta guía",
        p: [
          "Para la empresa que va a operar con el ISP por primera vez y se encontró con que casi todo se tramita en línea, pero la credencial para entrar no se saca en el mismo lugar donde se hacen los trámites.",
          "Es el paso que más veces bloquea un proyecto entero por un motivo administrativo, no técnico: el expediente está listo y no hay forma de presentarlo.",
        ],
      },
      {
        h: "Lo que conviene resolver antes de pedirla",
        p: [
          "Quién va a ser la persona responsable frente al ISP y si esa persona va a seguir en la empresa el año que viene. La credencial queda asociada a alguien, y cambiarla después cuesta más que pedirla bien la primera vez.",
          "Qué razón social va a figurar como titular. Si la empresa que importa no es la misma que va a quedar como titular del registro, esto hay que decidirlo ahora y no cuando ya haya expediente presentado.",
        ],
      },
      // TODO Nico: el cuerpo normativo de esta guía.
      //   - Qué es GICONA exactamente y qué trámites se hacen ahí.
      //   - Procedimiento paso a paso de solicitud, contra la página oficial.
      //   - Antecedentes que se acompañan y a qué unidad del ISP se dirigen.
      //   - Plazos reales y qué hacer si la solicitud queda observada.
    ],
  },
  {
    slug: "registrar-cosmetico-isp-chile",
    titulo: "Cómo registrar un cosmético en Chile ante el ISP",
    resumen:
      "Qué productos hay que inscribir, qué decisiones de fórmula y rotulado condicionan el trámite, y dónde se pierde el tiempo.",
    actualizada: "2026-09-16",
    fuenteOficial: {
      etiqueta:
        "Decreto Supremo N° 239, de 2002, del Ministerio de Salud — Reglamento del Sistema Nacional de Control de Cosméticos",
      url: "https://www.ispch.cl/sites/default/files/normativa_anamed/cosmeticos/Decreto%20Supremo%20239.pdf",
    },
    publicada: false,
    secciones: [
      {
        h: "Para quién es esta guía",
        p: [
          "Para marcas que ya tienen el producto formulado y descubren que no pueden venderlo todavía, y para importadores que van a traer una línea que afuera se vende sin trámite.",
          "Todo lo que sigue está escrito contra el Decreto Supremo N° 239, de 2002, del Ministerio de Salud, que es el reglamento del sistema nacional de control de cosméticos. Los números de artículo son de ese decreto.",
        ],
      },
      {
        h: "Lo que decide el trámite antes que el trámite",
        p: [
          "Lo que promete el envase. Un mismo frasco puede ser cosmético o dejar de serlo según lo que diga la etiqueta: cuando el texto empieza a prometer un efecto terapéutico, el producto cambia de categoría y con eso cambia todo el expediente.",
          "La fórmula cualitativa y cuantitativa completa, con los antecedentes del proveedor. Es lo que más demora en llegar cuando el fabricante está fuera de Chile, así que conviene pedirlo el primer día y no cuando ya está todo lo demás listo.",
        ],
      },
      {
        h: "Qué cuenta como cosmético para el ISP",
        p: [
          "El artículo 5° letra a) define el cosmético como cualquier preparado destinado a aplicarse externamente al cuerpo humano con fines de embellecimiento, modificación de su aspecto físico o conservación de las condiciones físico químicas normales de la piel y de sus anexos.",
          "El artículo 21° es la frase que resuelve la mayoría de las discusiones: todo producto cosmético, cualquiera sea su denominación, clase o finalidad, solamente debe tener acción local sobre la piel y sus anexos, y si es absorbido por el organismo debe carecer de efectos sistémicos. Ahí está la línea entre un cosmético y un medicamento, y no la decide el marketing.",
          "El artículo 20° enumera las finalidades que se entienden propias de un cosmético: higiene personal, maquillaje, coloración del cabello, bronceado, protección solar, embellecimiento capilar, depilación y epilación, cuidado de la piel, y cualquier otra que corresponda a las finalidades propias de un producto cosmético.",
          "El artículo 28° prohíbe designar un producto con un nombre de fantasía que pueda inducir a engaño en cuanto a sus propiedades cosméticas o su composición, y prohíbe en todo caso las denominaciones utilizadas en productos farmacéuticos o que se asocien a sus propiedades.",
          "El artículo 4° cierra el punto: los productos cosméticos importados o fabricados en el país, para ser comercializados y distribuidos en el territorio nacional, deben contar previamente con registro sanitario.",
        ],
      },
      {
        h: "No todos pasan por el mismo trámite",
        p: [
          "El artículo 5° separa del resto dos grupos. Los productos de bajo riesgo de producción, como los jabones sólidos destinados exclusivamente al aseo personal (letra b), y los productos de higiene: jabones líquidos, champúes, bálsamos acondicionadores, dentífricos, colutorios o enjuagatorios bucales, desodorantes, antiperspirantes, productos para rasurar la barba y para después de rasurarla, y talcos (letra c).",
          "Para esos dos grupos, y para los odorizantes, el artículo 20° dispone que se entienden registrados por el solo hecho de haberse autorizado sanitariamente el establecimiento productor o importador. A cambio, el establecimiento debe formular una declaración ante el Instituto dentro de los treinta días siguientes al comienzo de su funcionamiento o iniciación de actividades, con la individualización del propietario, su ubicación, línea de actividades y la fórmula y características de cada uno de sus productos.",
          "Eso no significa que el producto nuevo entre solo: cada uno de los productos de esos grupos debe ser notificado al Instituto antes de su comercialización en el país. El fabricante o importador puede además solicitar voluntariamente el registro.",
          "El artículo 22° evita registros duplicados: se consideran variedades de un mismo producto, y por ello no requieren registros adicionales, las composiciones que mantengan la misma concentración de sus ingredientes con actividad cosmética y conserven los mismos ingredientes comunes.",
          "Y el artículo 14° resuelve el caso de la exportación: los laboratorios no están obligados a registrar los cosméticos destinados exclusivamente a la exportación, basta con notificar al Instituto esa circunstancia. Pero la distribución y comercialización de esos mismos productos en el país debe hacerse previo registro.",
        ],
      },
      {
        h: "Qué se presenta",
        p: [
          "La solicitud se presenta en el Instituto, en formularios especiales aprobados por él, bajo la forma de una declaración jurada, suscrita por el interesado o su representante legal y por el responsable de la dirección técnica (artículo 23°). El mismo artículo agrega algo que conviene saber: no puede objetarse la recepción de una solicitud que contenga todas las declaraciones de los artículos 25° y 26°.",
          "Antes del producto va la empresa. El artículo 24° establece que el Instituto otorga un número de inscripción al titular con el solo mérito del formulario donde se declare nombre o razón social, representación legal, RUT, dirección y teléfono, exhibiendo cédula de identidad del declarante y acompañando copia de su inscripción como sociedad en el Registro de Comercio cuando corresponda. Ese número sirve de base al número de registro de cada producto.",
          "El formulario del artículo 25° consigna: identificación de quien solicita y, si actúa un mandatario, de la persona en cuya representación actúa, que será la titular del registro para todos los efectos legales; identificación del director técnico asesor que asume la responsabilidad de los requisitos técnicos del producto; denominación del producto y especificación de su finalidad cosmética; el objetivo de la solicitud, que puede ser producto de fabricación propia, fabricado en Chile por un tercero, importado terminado, o importado a granel o semielaborado y terminado en Chile; el nombre completo del mandante extranjero si se invoca el uso de una licencia o poder; el número de inscripción del solicitante en el Instituto; la descripción e interpretación de la clave o código; y los nombres completos y direcciones de las empresas fabricantes.",
          "El artículo 26° lista lo que se acompaña al formulario. Fórmula cualitativa completa y expresión cuantitativa de los ingredientes con actividad cosmética o que estén sujetos a restricciones de concentración, identificados por los nombres del Registro de Ingredientes Cosméticos del ISP o por nomenclatura INCI. Declaración técnica en idioma castellano, con las especificaciones del producto terminado, la metodología de identificación y valoración de los ingredientes cuantitativamente expresados en la fórmula, el período de vigencia señalando su fundamento técnico, y el tipo y material de los envases. Certificación de seguridad de uso expedida por profesional idóneo. Documentos legales, entre ellos el certificado de libre venta, el certificado oficial de producto cosmético u otro de la respectiva autoridad sanitaria del país de origen. Y el comprobante de pago del derecho arancelario.",
          "El artículo 27°, en su texto vigente tras el Decreto 41 de 2010, agrega requisitos por tipo de producto. Los Productos Cosméticos Especiales —protectores solares, tinturas para el cabello, decolorantes, activadores de color, alisadores y ondulantes de cabello, pastas dentales y enjuagatorios bucales con flúor, epilatorios y depilatorios exceptuando las ceras— deben indicar en las especificaciones del producto terminado la metodología de identificación y valoración de los ingredientes activos declarados en la fórmula. Y los que deseen anunciarse como protectores solares, hipoalergénicos o infantiles deben adjuntar un resumen de los estudios técnicos que permitan avalar esas propiedades, declarando que mantendrán los estudios completos a disposición de la autoridad sanitaria en todo momento.",
          "Un detalle que sale caro descubrir tarde: el artículo 33° dispone que la petición de registrar productos cosméticos diferentes, aunque se solicite para comercializarlos como un solo todo, se considera una solicitud independiente para cada uno de ellos.",
        ],
      },
      {
        h: "Cuánto demora y qué mira el ISP",
        p: [
          "El artículo 23° fija el plazo: el registro debe aprobarse o denegarse dentro de cinco días hábiles contados desde la recepción de la respectiva solicitud en el Instituto. Cuando la solicitud se presenta y resuelve por medios electrónicos, ese plazo baja a un máximo de tres días hábiles.",
          "Es un plazo corto porque la evaluación es acotada. El artículo 30° dice que el Instituto evalúa sobre la base de las declaraciones de los artículos 25° y 26°, y que esa revisión solo comprende cuatro aspectos: denominación, finalidad cosmética, fórmula y personería de los solicitantes. El mismo artículo lo autoriza a requerir la rectificación de las omisiones o errores que advierta y a devolver al interesado las solicitudes en que no se acompañen esos antecedentes.",
          "La fórmula se aprueba comparando sus ingredientes constitutivos con los listados de ingredientes autorizados, limitados o prohibidos que aprueba y publica el Instituto. A falta de ellos, el artículo 31° manda usar como referencia los listados de la Unión Europea contenidos en la Directiva 76/768/CEE y sus modificaciones posteriores, y los listados aprobados por la Food and Drug Administration de los Estados Unidos.",
          "El registro se otorga cuando la solicitud se acompaña con las declaraciones de los artículos 25° y 26° y los antecedentes del artículo 30° resultan evaluados satisfactoriamente (artículo 34°). La denegación no la decide el Instituto solo: el artículo 12° exige el pronunciamiento previo del Ministerio de Salud, y el Instituto dicta la resolución denegatoria únicamente una vez recibido ese pronunciamiento.",
        ],
      },
      {
        h: "El rotulado tiene su propia lista",
        p: [
          "El artículo 39° parte por la regla de fondo: la rotulación debe ceñirse a las normas del reglamento y corresponder a las declaraciones del registro. Lo que dice la etiqueta y lo que dice el expediente son el mismo documento, y el artículo 8° califica como producto falsificado aquel cuya rotulación en el envase no expresa lo declarado en el registro.",
          "El artículo 40° exige que la rotulación de los envases se haga en idioma español e indique, a lo menos: nombre del producto; finalidad cosmética, salvo que resulte obvia por la denominación; listado cualitativo de la fórmula completa según la Nomenclatura Internacional de Ingredientes Cosméticos (INCI), en orden decreciente de sus concentraciones, admitiéndose que la nómina de colorantes alternativos vaya precedida de la frase “puede contener”; período de vigencia mínima o fecha de expiración cuando fuera necesario; código o clave de la partida o serie de fabricación; contenido neto en unidades del sistema métrico decimal; nombre o razón social y dirección del titular y, cuando no coincida, también las del fabricante o importador, con indicación del país donde fue fabricado; modo de empleo, indicaciones, advertencias y precauciones sobre su uso según proceda; el número de registro aprobado por el Instituto, precedido de la sigla individualizadora “I.S.P.”; y las precauciones de almacenamiento y conservación cuando fuere necesario.",
          "Cuando el tamaño del envase no permite incluir todas esas indicaciones en el rótulo, o cuando el uso del cosmético puede constituir un riesgo para la salud de las personas, el mismo artículo obliga a agregar un prospecto adjunto al envase con las indicaciones, advertencias y precauciones.",
          "El artículo 40° bis suma menciones por tipo de producto. Los cosméticos infantiles deben llevar de forma destacada la leyenda “Permitido su uso en niños menores de 6 años”. Los protectores solares deben indicar el factor de protección solar según una tabla que agrupa el FPS medido en categorías —Protección Baja para los valores 6 y 10, Media para 15, 20 y 25, Alta para 30 y 50, y Muy Alta para 50+, que corresponde a un FPS medido igual o mayor a 60—, además del lapso para su reaplicación y las precauciones de uso y advertencias, entre ellas que en niños menores de seis meses de edad no se recomienda la exposición al sol. Y prohíbe expresamente las frases “protección total” y “a prueba de agua”, las que aludan al mismo significado, y toda otra que no pueda ser acreditada.",
          "Para productos importados terminados hay una salida práctica en el artículo 15°: si la rotulación de origen no contiene las menciones de las letras f) a j) del artículo 40°, los productos pueden ser recibidos en bodegas autorizadas donde se les agreguen las menciones faltantes antes de su distribución. Pero si esa rotulación carece además de alguna de las menciones de las letras a) a e), el producto se considera elaborado a granel, con todo lo que eso implica.",
        ],
      },
      {
        h: "Cuánto dura el registro y cuándo se cae",
        p: [
          "El artículo 10° establece que todo registro sanitario es válido por un período de cinco años contados desde la fecha de su aprobación, y que ese plazo se entiende automática y sucesivamente prorrogado, pagando el derecho arancelario, por períodos iguales, mientras no sea expresamente dejado sin efecto. El registro se establece en base a un rol por empresa.",
          "El artículo 11° lista las causales de cancelación: a petición del titular; si se comprueba falsificación o engaño en cualquiera de las declaraciones presentadas para solicitar el registro; si se comprueban cambios cualitativos o cuantitativos significativos en los ingredientes declarados; si se comprueban infracciones graves a las disposiciones sanitarias, entendiendo por tales las que comprometan la salud de la población; y si uno de los ingredientes del producto es eliminado del listado de ingredientes autorizados, se limita su uso, se reduce su concentración o se incluye en el listado de prohibidos.",
          "Esa última causal es la que conviene mirar con calendario propio, porque no depende de nada que haga el titular. Un cambio en los listados de ingredientes puede alcanzar a un producto que lleva años en el mercado sin que nadie en la empresa se entere.",
          "La modificación de un registro debe hacerse mediante resolución fundada (artículo 37°). El registro puede ser transferido por quien lo obtuvo a otra persona natural o jurídica, y si fue concedido en virtud de una licencia o poder, la transferencia solo puede autorizarse con el consentimiento del licenciante, conocimiento del licenciado y solicitud del nuevo apoderado (artículo 38°).",
        ],
      },
      {
        h: "Antes de usar esta guía para decidir",
        p: [
          "El texto de arriba está tomado del Decreto Supremo N° 239 en la versión que incorpora el Decreto 41 de 2010. El listado oficial del ISP registra además una modificación con fecha 04-11-2010 cuya norma modificatoria no está identificada en nuestra base, así que antes de cerrar una decisión conviene revisar la versión vigente en el enlace de la fuente oficial.",
          "Esta guía tampoco trae el arancel. Los montos cambian y publicarlos desactualizados es peor que no publicarlos: el valor vigente se consulta directamente en el Instituto de Salud Pública al momento de presentar.",
        ],
      },
      // TODO Nico, antes de cambiar `publicada` a true:
      //   - Arancel vigente del registro de cosméticos, con fuente y fecha de
      //     consulta. No está en el corpus.
      //   - Confirmar la modificación del 04-11-2010 que marca el listado
      //     oficial y, si cambia algo de lo escrito arriba, corregirlo.
      //   - Agregar los errores de rotulado que más observación generan, desde
      //     tu experiencia. Eso no está en ninguna norma y es lo que hace que
      //     esta guía valga más que el decreto.
    ],
  },
  {
    slug: "registro-dispositivos-medicos-isp",
    titulo: "Registro de dispositivos médicos en Chile: qué exige el ISP",
    resumen:
      "Qué dispositivos están bajo control sanitario obligatorio, cómo pesa la clasificación de riesgo y qué se presenta ante el ISP.",
    actualizada: "2026-09-16",
    fuenteOficial: {
      etiqueta: "ChileAtiende — Registro sanitario de dispositivos médicos bajo control obligatorio",
      url: "https://www.chileatiende.gob.cl/fichas/14538-registro-sanitario-de-dispositivos-medicos-bajo-control-sanitario",
    },
    publicada: false,
    secciones: [
      {
        h: "Para quién es esta guía",
        p: [
          "Para el importador o distribuidor que necesita saber si el dispositivo que va a traer requiere registro, y para el que ya lo trajo y se enteró en la aduana.",
        ],
      },
      {
        h: "La clasificación es la decisión cara",
        p: [
          "De la clase de riesgo depende si el producto necesita registro y qué antecedentes técnicos hay que presentar. Clasificar mal al principio es el error más caro del proceso, porque obliga a rehacer el expediente completo en vez de corregir una parte.",
          "El uso previsto que declara el fabricante es lo que manda, no el nombre comercial ni cómo se venda el producto en otro mercado.",
        ],
      },
      // TODO Nico: el cuerpo normativo de esta guía.
      //   - Listado vigente de dispositivos bajo control obligatorio.
      //   - Criterios de clasificación y qué implica cada clase.
      //   - Documentación técnica exigida y certificados de libre venta.
      //   - Qué pasa con un producto que llegó sin registro.
    ],
  },
  {
    slug: "vence-registro-sanitario-isp",
    titulo: "Se me vence el registro sanitario: qué pasa y cómo renovarlo",
    resumen:
      "Con cuánta anticipación hay que moverse, qué ocurre con el producto en el intertanto y qué diferencia una renovación de un registro nuevo.",
    actualizada: "2026-09-16",
    fuenteOficial: {
      etiqueta:
        "Decreto Supremo N° 3, de 2010, del Ministerio de Salud — Reglamento del Sistema Nacional de Control de Productos Farmacéuticos de Uso Humano",
      url: "https://www.bcn.cl/leychile/navegar?idNorma=1026879",
    },
    publicada: false,
    secciones: [
      {
        h: "Para quién es esta guía",
        p: [
          "Para el titular que tiene el producto en el mercado y descubrió la fecha de vencimiento mirando la resolución, normalmente demasiado tarde.",
          "El cuerpo de esta guía está escrito contra el Decreto Supremo N° 3, de 2010, del Ministerio de Salud, que rige los productos farmacéuticos de uso humano. Donde el trato de los cosméticos es distinto, se dice y se cita el Decreto Supremo N° 239, de 2002.",
        ],
      },
      {
        h: "El problema es el calendario, no el trámite",
        p: [
          "Una renovación presentada a tiempo es un trámite administrativo. La misma renovación presentada tarde es un producto detenido, con stock inmovilizado y clientes preguntando.",
          "Si en el intertanto cambió la fórmula, la planta, el titular o el envase, eso no se arregla dentro de la renovación: son modificaciones que van por su propia vía y conviene ordenarlas antes de que se junten con el vencimiento.",
        ],
      },
      {
        h: "Cuánto dura un registro sanitario",
        p: [
          "Para una especialidad farmacéutica, el artículo 55° del Decreto Supremo N° 3 fija una vigencia de cinco años contados desde la fecha de la resolución que lo concede, y permite renovarlo por períodos iguales y sucesivos siempre que no haya sido cancelado y se cumplan las condiciones que el mismo artículo enumera.",
          "Para un cosmético el régimen es distinto y más benévolo. El artículo 10° del Decreto Supremo N° 239 también fija cinco años, pero contados desde la fecha de aprobación, y dispone que el plazo se entiende automática y sucesivamente prorrogado, pagando el derecho arancelario, por períodos iguales, mientras no sea expresamente dejado sin efecto.",
          "La diferencia no es de redacción: el cosmético se prorroga con el pago, el farmacéutico exige además que se cumplan condiciones y puede denegarse.",
        ],
      },
      {
        h: "Las tres condiciones del artículo 55°",
        p: [
          "La primera es el pago del arancel correspondiente.",
          "La segunda es la superación de las observaciones formuladas para la suspensión del registro sanitario dentro del plazo concedido para ello. Y trae el único plazo de días que el artículo fija: si la vigencia del registro expirare estando pendiente ese plazo, la renovación debe solicitarse dentro de los 15 días posteriores al vencimiento del plazo otorgado para superar dichas observaciones.",
          "La tercera es la inexistencia de multas pendientes de pago, o de otras medidas o sanciones sanitarias aplicadas por el Instituto, en relación con el registro que se pretende renovar.",
          "El inciso final del artículo cierra la puerta por el otro lado: la renovación del registro sanitario debe ser denegada cuando se constate el incumplimiento de alguna de las obligaciones que corresponden al titular. No es una facultad, está redactado como un deber.",
        ],
      },
      {
        h: "Qué se acompaña y qué devuelve el ISP",
        p: [
          "La solicitud de renovación se presenta ante el Instituto. Tratándose de productos importados, el artículo 56° exige acompañarla del Certificado de producto farmacéutico, o el Certificado de registro, o el Certificado de autorización sanitaria, o la certificación oficial recomendada por la Organización Mundial de la Salud, emitido por la autoridad sanitaria del país de procedencia.",
          "Ese certificado debe acreditar cuatro cosas: que el establecimiento productor o almacenador, según corresponda, reúne las condiciones exigidas por la legislación sanitaria de su país; que el producto está registrado allá de acuerdo a la normativa vigente; su fórmula autorizada íntegra; y si su expendio está sometido a algún régimen restrictivo o control especial de tipo sanitario.",
          "Ese documento es el que conviene pedir primero, porque no depende ni de ti ni del ISP: lo emite una autoridad extranjera y llega cuando llega.",
          "La resolución de renovación mantiene la numeración de registro asignada en la inscripción, le agrega el año de renovación y señala la nueva fecha de caducidad (artículo 57°). El número no cambia, la fecha sí.",
        ],
      },
      {
        h: "La anticipación que el reglamento no fija",
        p: [
          "Conviene decirlo derecho, porque es la primera pregunta que hace todo el mundo: el Decreto Supremo N° 3 no establece un plazo general de anticipación para pedir la renovación. El único plazo expreso en esta materia es el de 15 días del numeral 2 del artículo 55°, y aplica a un caso puntual, el del registro que expira mientras corre el plazo para superar las observaciones de una suspensión.",
          "La fecha que manda, entonces, es la de caducidad que fija la resolución vigente, y lo que hay que estimar de verdad no es cuánto demora el Instituto sino cuánto demora reunir los antecedentes del artículo 56°, en particular el certificado extranjero.",
        ],
      },
      {
        h: "Lo que la renovación no arregla",
        p: [
          "Renovar no es modificar. El artículo 65° permite al Instituto autorizar, a petición del titular y mediante resolución, modificaciones en la expresión de la fórmula incluyendo la composición de los excipientes, las especificaciones y métodos de control del producto terminado y el período de eficacia, la presentación, contenido, tipo de envase y dispositivos de administración —adjuntando los estudios de estabilidad si lo que cambia es el envase primario—, la condición de venta, la denominación y el rotulado gráfico, el régimen, procedencia, acondicionador, licenciante, distribuidor, importador y laboratorio farmacéutico de control de calidad, así como la razón social de cualquiera de ellos y del titular, los folletos de información al profesional y al paciente, y las indicaciones terapéuticas, esquemas terapéuticos, grupo etáreo y nueva vía de administración.",
          "El numeral 9 del mismo artículo marca el límite: los cambios que alteran la naturaleza e identidad de la especialidad farmacéutica —el principio activo, su dosis, su forma farmacéutica, o cuando la modificación altera su sistema de liberación— no son modificaciones. Requieren otro registro.",
          "Lo mismo ocurre con el fabricante. El artículo 69° permite resolver conjuntamente un cambio de titularidad con otras modificaciones, salvo que se requiera un cambio de fabricante, caso en que se debe solicitar un nuevo registro.",
          "Y hay que contar los tiempos. El artículo 66° da al Instituto un plazo no superior a tres meses contados desde la presentación para dar o no lugar a una solicitud de modificación, con excepción de las del numeral 8 del artículo 65°, que se someten al procedimiento ordinario de registro. Si durante la evaluación se verifica que los antecedentes son insuficientes, se notifican las objeciones con un plazo no inferior a diez ni superior a treinta días hábiles para superarlas.",
          "Tres meses de modificación encima de una fecha de caducidad es exactamente la suma que convierte un trámite administrativo en un producto detenido. Las modificaciones que no inciden en los aspectos técnicos relacionados con la calidad, seguridad y eficacia corren con otra suerte: el artículo 67° dispone que basta que el titular las notifique al Instituto, que procede a su actualización.",
        ],
      },
      {
        h: "Suspensión, cancelación y el producto que ya está afuera",
        p: [
          "El artículo 58° permite suspender un registro por dos causales: si se comprueban cambios significativos en la indicación terapéutica, la composición, las formas de dosificación, la aplicación u otras condiciones anunciadas en la rotulación, la información al profesional o la publicidad, que no correspondan a lo aprobado en el registro sanitario; y si se presentan fallas a la calidad del producto en dos series. La resolución que suspende determina sus alcances y fija el plazo para subsanar; si no se cumple, se procede a la cancelación.",
          "El artículo 59° lista las causales de cancelación: que el Instituto se forme la convicción, con antecedentes de la Organización Mundial de la Salud, de otros organismos o de su propia investigación, de que el producto no es seguro o eficaz conforme a lo aprobado, generándose peligro manifiesto para la salud pública, una relación riesgo/beneficio terapéutico desfavorable o ineficacia terapéutica; que se compruebe que datos suministrados en la solicitud fueron debidamente acreditados como falsos; y que, habiéndose suspendido el registro, no se hayan subsanado los motivos dentro del plazo fijado.",
          "La consecuencia operativa está en el artículo 60°, y es la parte cara: el titular del registro cancelado o suspendido es responsable de tomar las medidas necesarias para la adecuada recolección, destrucción o desnaturalización, cuando el Instituto así lo determine, de las unidades que estén en sus dependencias y de aquellas ya distribuidas a otros establecimientos, y de informar al público usuario que pudiere estar en condiciones de hacer uso personal del producto.",
          "Tanto la suspensión como la cancelación deben determinarse por resolución fundada del Instituto, notificada a quien figure como titular (artículo 61°).",
        ],
      },
      {
        h: "Lo que el reglamento no resuelve",
        p: [
          "Hay dos preguntas que el Decreto Supremo N° 3 no contesta de forma expresa, y es más útil decirlo que rellenarlas. La primera es qué ocurre con el producto ya distribuido mientras la solicitud de renovación está en trámite. La segunda es el registro que caducó sin que nadie pidiera la renovación: fuera del caso puntual del numeral 2 del artículo 55°, el reglamento no contempla una renovación fuera de plazo.",
          "Esos vacíos se resuelven caso a caso frente al Instituto, y son justamente la situación en la que no conviene improvisar ni asumir el criterio que le sirvió a otro.",
          "Una advertencia de fuente: el listado oficial del ISP registra una modificación al Decreto Supremo N° 3 con fecha 20-12-2019 cuya norma modificatoria no está identificada en nuestra base. Antes de cerrar una decisión, revisa la versión vigente en el enlace de la fuente oficial.",
        ],
      },
      // TODO Nico, antes de cambiar `publicada` a true:
      //   - Arancel vigente de renovación, con fuente y fecha de consulta.
      //   - Confirmar la modificación del 20-12-2019 que marca el listado
      //     oficial y corregir lo que haya cambiado.
      //   - El plazo de anticipación que recomiendas tú. El reglamento no fija
      //     ninguno, así que ese número es criterio profesional y tiene que
      //     salir de tu experiencia, no de una norma.
      //   - Qué has visto que pasa en la práctica con el producto en el
      //     mercado mientras la renovación está en trámite.
    ],
  },
];

/** Solo las guías con cuerpo escrito y revisado. Es lo único que el sitio muestra. */
export function guiasPublicadas(): Guia[] {
  return GUIAS.filter((g) => g.publicada);
}

export function guiaPorSlug(slug: string): Guia | undefined {
  return guiasPublicadas().find((g) => g.slug === slug);
}
