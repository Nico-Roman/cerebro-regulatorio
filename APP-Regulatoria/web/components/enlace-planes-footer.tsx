"use client";

// "Planes de IA" en el pie de página, solo para quien NO tiene sesión. A quien
// ya se registró no se le ofrecen planes fuera de la oferta única y del aviso
// de límite (components/modal-planes.tsx). Va en el cliente para que el pie
// siga siendo estático y las páginas de contenido se prerendericen.

import Link from "next/link";
import { useSession } from "@/lib/auth-client";

export function EnlacePlanesFooter() {
  const { data: sesion, isPending } = useSession();
  if (isPending || sesion) return null;
  return (
    <li>
      <Link href="/planes" className="text-muted hover:text-foreground">
        Planes de IA
      </Link>
    </li>
  );
}
