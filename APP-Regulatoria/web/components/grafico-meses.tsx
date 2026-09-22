// Barras agrupadas por mes: ingreso neto contra costo de IA. SVG en el
// servidor, sin librerías: el panel no necesita más que esto y así no suma
// peso al bundle.
//
// Reglas de la guía de visualización: un solo eje, dos series con leyenda y
// colores validados para daltonismo (azul/naranja sobre fondo oscuro), barras
// finas con 2 px de separación, tooltip nativo por barra (<title>) y la tabla
// con los mismos números debajo.

import { formatoClp } from "@/lib/planes";

export interface PuntoMes {
  mes: string;
  a: number;
  b: number;
}

const COLOR_A = "#3987e5";
const COLOR_B = "#d95926";

function mesCorto(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const nombres = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${nombres[m - 1]}${m === 1 ? ` ${String(anio).slice(2)}` : ""}`;
}

/** Escala "linda": 1, 2 o 5 × 10^n por encima del máximo. */
function techo(max: number): number {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const f of [1, 2, 5, 10]) if (f * p >= max) return f * p;
  return 10 * p;
}

export function GraficoMeses({
  puntos,
  etiquetaA,
  etiquetaB,
  titulo,
}: {
  puntos: PuntoMes[];
  etiquetaA: string;
  etiquetaB: string;
  titulo: string;
}) {
  const W = 720;
  const H = 220;
  const IZQ = 64;
  const ABAJO = 24;
  const ARRIBA = 8;
  const alto = H - ABAJO - ARRIBA;
  const max = techo(Math.max(...puntos.flatMap((p) => [p.a, p.b]), 0));
  const paso = (W - IZQ) / Math.max(1, puntos.length);
  const barra = Math.min(18, (paso - 10) / 2);
  const y = (v: number) => ARRIBA + alto - (Math.max(0, v) / max) * alto;
  const lineas = [0, 0.5, 1].map((f) => f * max);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="label-micro text-muted">{titulo}</span>
        <span className="flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_A }} />
            {etiquetaA}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_B }} />
            {etiquetaB}
          </span>
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={titulo}>
        {lineas.map((v) => (
          <g key={v}>
            <line x1={IZQ} x2={W} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={IZQ - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.55}>
              {formatoClp(v)}
            </text>
          </g>
        ))}
        {puntos.map((p, i) => {
          const x = IZQ + i * paso + (paso - (barra * 2 + 2)) / 2;
          return (
            <g key={p.mes}>
              {/* Zona de hover más grande que las barras. */}
              <rect x={IZQ + i * paso} y={ARRIBA} width={paso} height={alto} fill="transparent">
                <title>{`${p.mes}\n${etiquetaA}: ${formatoClp(p.a)}\n${etiquetaB}: ${formatoClp(p.b)}`}</title>
              </rect>
              <rect x={x} y={y(p.a)} width={barra} height={Math.max(0, y(0) - y(p.a))} rx={3} fill={COLOR_A} pointerEvents="none" />
              <rect
                x={x + barra + 2}
                y={y(p.b)}
                width={barra}
                height={Math.max(0, y(0) - y(p.b))}
                rx={3}
                fill={COLOR_B}
                pointerEvents="none"
              />
              <text x={IZQ + i * paso + paso / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.55}>
                {mesCorto(p.mes)}
              </text>
            </g>
          );
        })}
      </svg>

      <details>
        <summary className="cursor-pointer text-xs text-muted">ver como tabla</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="py-1 pr-4">Mes</th>
              <th className="py-1 pr-4">{etiquetaA}</th>
              <th className="py-1">{etiquetaB}</th>
            </tr>
          </thead>
          <tbody>
            {puntos.map((p) => (
              <tr key={p.mes} className="border-t border-line">
                <td className="py-1 pr-4">{p.mes}</td>
                <td className="py-1 pr-4">{formatoClp(p.a)}</td>
                <td className="py-1">{formatoClp(p.b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
