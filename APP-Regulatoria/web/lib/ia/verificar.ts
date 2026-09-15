// Verificación mecánica del borrador contra los pasajes que se le entregaron.
//
// resolverCitas() ya garantiza que la ETIQUETA de la cita es real: [P3] no
// puede apuntar a una norma que no estaba. Lo que no garantiza es que la
// AFIRMACIÓN lo sea. Un borrador puede decir «el plazo es de 15 días [P3]»
// cuando el pasaje 3 dice 30: la cita resuelve, el enlace funciona, y el dato
// es inventado. Es la falla más cara del sistema, porque llega a la pantalla
// con toda la apariencia de estar respaldada.
//
// Tres reglas, las tres mecánicas:
//   cifras   todo número que el modelo escriba tiene que existir en los pasajes
//            que recibió: artículos, normas, plazos, montos, porcentajes, años.
//   normas   toda norma que nombre en prosa sin número («Reglamento de
//            Farmacias») tiene que estar en un pasaje.
//   caso     si los pasajes que citó no mencionan el caso concreto que se
//            preguntó («uso personal»), el borrador tiene que decirlo; si no,
//            está presentando la regla de otra materia como la respuesta.
//
// Conservador por diseño: prefiere marcar de más (la persona revisa) a dejar
// pasar una cifra fabricada. Cada falso positivo encontrado en la evaluación
// quedó corregido acá con su caso: «10 000» con espacio, «cuatrocientas» en
// letras, el número de la norma que solo está en el encabezado.

// ── Cifras ──────────────────────────────────────────────────────────────────

// Números escritos con palabras, como los escribe la ley: «multa de cuarenta a
// cuatrocientas unidades tributarias mensuales». Se leen como secuencia, así
// «ciento ochenta» es 180 y «mil» multiplica lo que venga antes.
const UNIDADES: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300,
  trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800,
  ochocientas: 800, novecientos: 900, novecientas: 900,
};

function planoSinTildes(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function numerosEnLetras(texto: string): string[] {
  const salida: string[] = [];
  let total = 0;
  let actual = 0;
  let enNumero = false;
  const cerrar = () => {
    if (enNumero) salida.push(String(total + actual));
    total = 0;
    actual = 0;
    enNumero = false;
  };
  for (const palabra of planoSinTildes(texto).split(" ")) {
    if (palabra in UNIDADES) {
      actual += UNIDADES[palabra];
      enNumero = true;
    } else if (palabra === "mil" || palabra === "millon" || palabra === "millones") {
      total = (total + (actual || 1)) * (palabra === "mil" ? 1000 : 1_000_000);
      actual = 0;
      enNumero = true;
    } else if (palabra === "y" && enNumero) {
      continue;
    } else {
      cerrar();
    }
  }
  cerrar();
  return salida;
}

/**
 * Números como cadenas comparables. Sin separadores de miles (1.651, 1651 y
 * «10 000» son lo mismo) y con los decimales como una sola cifra: «10,0 %» es
 * 10, no un 10 y un 0, y «2,5» es 2.5.
 */
function numerosDe(texto: string): string[] {
  const plano = texto
    .toLowerCase()
    // Separadores de miles: punto, coma, espacio y los espacios finos que usa
    // gpt-oss («10 000» con U+202F).
    .replace(/(\d)[.,    ](?=\d{3}(?!\d))/g, "$1")
    .replace(/(\d)[.,](\d{1,2})(?!\d)/g, "$1.$2");
  return [...plano.matchAll(/\d+(?:\.\d+)?/g)].map((m) =>
    m[0].replace(/^0+(?=\d)/, "").replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
  );
}

// ── Normas nombradas ────────────────────────────────────────────────────────

// «Reglamento de Farmacias», «Código Sanitario», «Ley Ricarte Soto». Exige
// mayúscula en la palabra que sigue, así «la ley establece» no cuenta. Las
// normas con número ya las cubre la regla de cifras.
const RX_NORMA_NOMBRADA =
  /(?:^|[^\p{L}])((?:Ley|Decreto|Reglamento|C[óo]digo|Resoluci[óo]n|Norma(?: General)? T[ée]cnica|Circular|Gu[íi]a|Manual)(?:\s+(?:(?:de|del|la|las|los|el|sobre|para|y)\s+)?\p{Lu}[\p{L}]+)+)/gu;
const CONECTORES = new Set(["de", "del", "la", "las", "los", "el", "sobre", "para", "y"]);

/**
 * El nombre cuenta como respaldado si todas sus palabras significativas están
 * en un mismo pasaje. No se exige la frase exacta: el título oficial dice
 * «reglamento del sistema nacional control de cosméticos», sin el «de», y la
 * ley 20.850 nombra a «Luis Ricarte Soto» pero nunca escribe «Ley Ricarte Soto».
 */
function normaEnPasajes(nombre: string, pasajesPlanos: Set<string>[]): boolean {
  const palabras = planoSinTildes(nombre)
    .split(" ")
    .filter((p) => !CONECTORES.has(p));
  return pasajesPlanos.some((ps) => palabras.every((p) => ps.has(p)));
}

// ── Caso concreto ───────────────────────────────────────────────────────────

// Verbos de mostrador que el motor deja como concepto («¿qué registros debe
// TENER una farmacia?»). No son el caso de la pregunta: que el pasaje no diga
// «tener» no significa que trate otra materia. Lista medida sobre la
// evaluación del 14-09-2026, no un diccionario: agregar solo con su caso.
const VERBOS_DE_PREGUNTA = new Set([
  "tener", "presentar", "considera", "consideran", "considerar", "entiende", "entender", "significa",
  "pedir", "solicitar", "obtener", "vender", "comprar", "usar", "utilizar", "llevar", "hacer",
]);

// Oración en la que el borrador reconoce que los pasajes no cubren algo. Se
// aplica sobre la oración ya sin tildes ni puntuación.
const RX_SALVEDAD =
  /\bno\b.*?\b(?:trata|tratan|aborda|abordan|menciona|mencionan|se refiere|se refieren|regula|regulan|especifica|especifican|contempla|contemplan|incluye|incluyen|cubre|cubren|indica|indican|establece|establecen|precisa|precisan)\b/;

/**
 * De los conceptos que los pasajes citados no mencionan, los que el borrador
 * tampoco reconoce como no cubiertos. El reconocimiento tiene que nombrar el
 * concepto: «los pasajes no especifican el trámite» no salva que se preguntó
 * por «uso personal».
 */
export function casoSinSalvedad(textoModelo: string, conceptosFaltantes: string[]): string[] {
  const salvedades = textoModelo
    .split(/(?<=[.;])\s+/)
    .map(planoSinTildes)
    .filter((o) => RX_SALVEDAD.test(o));
  return conceptosFaltantes
    .filter((c) => !VERBOS_DE_PREGUNTA.has(c))
    .filter((c) => {
      // Por raíz: «personal» se salva con «personales», «falsificado» con «falsificados».
      const raiz = planoSinTildes(c).slice(0, Math.max(4, Math.min(c.length - 1, 7)));
      return !salvedades.some((o) => o.includes(raiz));
    });
}

// ── Verificación ────────────────────────────────────────────────────────────

const RX_MARCA_CITA = /[[【]\s*P\s*\d+(?:[^\]】]*)?[\]】]/gi;

export interface Verificacion {
  /** Números del borrador que no aparecen en ningún pasaje entregado. */
  noVerificados: string[];
  /** Normas nombradas en prosa que no aparecen en ningún pasaje entregado. */
  normasNoVerificadas: string[];
  ok: boolean;
}

/**
 * @param textoModelo  la salida CRUDA del modelo, antes de resolver las citas
 *                     (después, las citas insertadas por el servidor traerían
 *                     sus propios números y ensuciarían la medición).
 * @param textosPasajes cada pasaje tal como lo leyó el modelo: encabezado
 *                     (cita, norma, título, vigencia) y texto. El número de una
 *                     norma suele estar solo en el encabezado, y el modelo lo vio.
 */
export function verificarDatos(textoModelo: string, textosPasajes: string[]): Verificacion {
  const permitidos = new Set<string>();
  for (const t of textosPasajes) {
    for (const n of numerosDe(t)) permitidos.add(n);
    for (const n of numerosEnLetras(t)) permitidos.add(n);
  }

  const sinCitas = textoModelo.replace(RX_MARCA_CITA, " ");
  const noVerificados = [...new Set(numerosDe(sinCitas))].filter((n) => !permitidos.has(n));

  const pasajesPlanos = textosPasajes.map((t) => new Set(planoSinTildes(t).split(" ")));
  const normasNoVerificadas = [
    ...new Set(
      [...sinCitas.matchAll(RX_NORMA_NOMBRADA)]
        .map((m) => m[1].trim())
        .filter((nombre) => !normaEnPasajes(nombre, pasajesPlanos))
    ),
  ];

  return {
    noVerificados,
    normasNoVerificadas,
    ok: noVerificados.length === 0 && normasNoVerificadas.length === 0,
  };
}
