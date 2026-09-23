"use client";

// La única oferta de planes que ve alguien registrado sin haber llegado a su
// límite: aparece una vez, la primera vez que entra al buscador después de
// registrarse. Se marca como mostrada apenas aparece (no al cerrarla): si la
// persona cierra la pestaña, igual cuenta como ofrecida y no vuelve a salir.

import { useCallback, useEffect, useState } from "react";
import { ModalPlanes } from "@/components/modal-planes";

export function OfertaInicial() {
  const [abierta, setAbierta] = useState(true);

  useEffect(() => {
    void fetch("/api/planes/ofrecidos", { method: "POST" }).catch(() => {
      // Si falla, en el peor caso se ofrece una segunda vez. No vale la pena
      // molestar a la persona con un error por esto.
    });
  }, []);

  const cerrar = useCallback(() => setAbierta(false), []);
  if (!abierta) return null;
  return <ModalPlanes motivo="bienvenida" planActual="gratis" onCerrar={cerrar} />;
}
