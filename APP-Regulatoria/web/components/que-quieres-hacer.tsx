import Link from "next/link";

// Entrada a los modos del asistente (encargo D): preguntar, responder una
// observación del ISP o saber qué trámite toca. «¿Qué trámite necesito?» solo
// aparece con FLUJO_TRAMITE=on.
export function QueQuieresHacer({ actual, tramite }: { actual: "preguntar" | "observacion" | "tramite"; tramite: boolean }) {
  const opciones = [
    { id: "preguntar", href: "/normativa", texto: "Preguntar" },
    { id: "observacion", href: "/asistente/observacion", texto: "Responder una observación del ISP" },
    ...(tramite ? [{ id: "tramite", href: "/asistente/tramite", texto: "¿Qué trámite necesito?" }] : []),
  ];
  return (
    <nav aria-label="¿Qué quieres hacer?" className="flex flex-col gap-2">
      <span className="label-micro text-muted">¿Qué quieres hacer?</span>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <Link
            key={o.id}
            href={o.href}
            aria-current={o.id === actual ? "page" : undefined}
            className={`border px-3 py-1.5 text-xs transition-colors ${
              o.id === actual
                ? "border-accent text-accent"
                : "border-line text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            {o.texto}
          </Link>
        ))}
      </div>
    </nav>
  );
}
