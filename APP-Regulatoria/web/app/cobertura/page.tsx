import type { Metadata } from "next";
import Link from "next/link";
import { OG_IMAGEN, SITE } from "@/lib/site";
import { estadoCorpus, fechaLegible } from "@/lib/estado-corpus";
import { materiasNoIncluidas, normasCubiertas } from "@/lib/cobertura";

export const metadata: Metadata = {
  title: "Qué normas incluye",
  description:
    "Lista completa de las normas sanitarias chilenas que incluye el asistente de RegulaMED (ISP/ANAMED, Código Sanitario y más), con su enlace oficial, y lo que no incluye.",
  alternates: { canonical: "/cobertura" },
  openGraph: {
    title: `Qué normas incluye · ${SITE.nombre}`,
    url: "/cobertura",
    images: [OG_IMAGEN],
  },
};

// El corpus viene en la imagen y solo cambia con un despliegue: la página se
// genera en el build, con el corpus de ese build.
export default function CoberturaPage() {
  const normas = normasCubiertas();
  const fuera = materiasNoIncluidas();
  const estado = estadoCorpus();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <span className="label-micro text-muted">Cobertura</span>
      <h1 className="font-display mt-4 text-3xl leading-tight tracking-tight sm:text-4xl">Qué normas incluye</h1>
      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
        El asistente responde solo con el texto de estas {normas.length} normas. Corpus actualizado al{" "}
        {fechaLegible(estado.generado)}; la vigencia se toma del listado oficial del ISP y, para las leyes, del
        texto refundido de la BCN. Si tu pregunta es de una materia que no está acá, el asistente te lo dice en vez
        de responder.
      </p>

      <section className="mt-10 border-l-2 border-amber-500/60 pl-5">
        <h2 className="label-micro text-muted">Lo que no incluye</h2>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
          <li>Los alimentos y los suplementos alimenticios (Reglamento Sanitario de los Alimentos, SEREMI).</li>
          {fuera.map((m) => (
            <li key={m}>{m.charAt(0).toUpperCase() + m.slice(1)}.</li>
          ))}
          <li>Proyectos de ley y normas que todavía no se publican.</li>
        </ul>
      </section>

      <div className="mt-10 overflow-x-auto border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-surface">
            <tr className="label-micro text-muted">
              <th className="px-3 py-2.5 font-normal">Norma</th>
              <th className="px-3 py-2.5 font-normal">Materia</th>
              <th className="px-3 py-2.5 font-normal">Fecha</th>
              <th className="px-3 py-2.5 font-normal">Título</th>
              <th className="px-3 py-2.5 font-normal">Fuente</th>
            </tr>
          </thead>
          <tbody>
            {normas.map((n) => (
              <tr key={n.normaId} className="border-b border-line align-top last:border-b-0">
                <td className="px-3 py-2.5 font-medium whitespace-nowrap">{n.nombre}</td>
                <td className="px-3 py-2.5 text-xs text-muted">{n.materias.join(" · ")}</td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap text-muted">{n.fecha}</td>
                <td className="px-3 py-2.5 text-xs leading-relaxed text-muted">
                  {n.titulo}
                  {n.vigencia && n.vigencia !== "vigente" ? " · vigencia no verificada" : ""}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {n.enlace ? (
                    <a href={n.enlace} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                      Oficial ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-sm text-muted">
        ¿Falta una norma que usas?{" "}
        <Link href="/#contacto" className="text-foreground underline underline-offset-4">
          Escríbenos
        </Link>{" "}
        y la evaluamos.
      </p>
    </main>
  );
}
