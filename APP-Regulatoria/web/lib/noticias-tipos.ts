export type CategoriaNoticia = "farmaceuticos" | "cosmeticos" | "suplementos" | "dispositivos";

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
  /** Quién la agregó: a mano o el flujo diario de n8n. No sale en pantalla. */
  origen?: "manual" | "n8n";
  /** Instante en que entró al archivo (solo las de n8n). No sale en pantalla. */
  agregada?: string;
}

/** Bitácora de la última corrida automática. No sale en pantalla. */
export interface RevisionNoticias {
  ts: string;
  agregadas: number;
  descartadas: number;
  fuentes_ok: string[];
  fuentes_caidas: string[];
}
