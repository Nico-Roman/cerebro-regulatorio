"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function BotonSalir() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  return (
    <button
      type="button"
      disabled={saliendo}
      onClick={async () => {
        setSaliendo(true);
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
      className="label-micro border border-line px-3.5 py-2 transition-colors hover:border-foreground disabled:opacity-60"
    >
      {saliendo ? "Saliendo…" : "Salir"}
    </button>
  );
}
