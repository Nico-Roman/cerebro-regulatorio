// CSV del panel. Módulo aparte y sin dependencias para poder probarlo sin base
// de datos (ver tests/csv.test.ts).
//
// Las celdas llevan texto que escribió una persona: la pregunta, el nombre, la
// empresa. Excel y Google Sheets ejecutan como fórmula cualquier celda que
// empiece con = + - @ (o tabulador / retorno de carro), así que una "pregunta"
// como `=HYPERLINK("https://…","ver norma")` llegaba viva a la planilla del
// administrador. Se neutraliza anteponiendo una comilla simple, que es la forma
// que ambos programas reconocen para "esto es texto".

const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

export function celdaCsv(valor: unknown): string {
  let texto = valor === null || valor === undefined ? "" : String(valor);
  if (INICIO_DE_FORMULA.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

/** CSV separado por punto y coma. Excel en español abre esto sin pelear. */
export function aCsv(filas: Record<string, unknown>[]): string {
  if (!filas.length) return "";
  const columnas = Object.keys(filas[0]);
  return [
    columnas.join(";"),
    ...filas.map((f) => columnas.map((c) => celdaCsv(f[c])).join(";")),
  ].join("\r\n");
}
