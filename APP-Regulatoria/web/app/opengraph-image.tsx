import { ImageResponse } from "next/og";

// Imagen para compartir de todo el sitio: sin ella, LinkedIn y WhatsApp
// muestran el enlace sin vista previa. Next la declara como og:image en cada
// página que no traiga una propia.
export const alt = "RegulaMED — asuntos regulatorios farmacéuticos en Chile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0d0d0d",
          color: "#f5f5f5",
        }}
      >
        <div style={{ fontSize: 32, letterSpacing: 8, color: "#a3a3a3" }}>REGULAMED</div>
        <div style={{ fontSize: 72, lineHeight: 1.08, fontWeight: 600 }}>
          Registro sanitario y normativa ISP, con la cita exacta
        </div>
        <div style={{ fontSize: 30, color: "#a3a3a3" }}>
          Nicolás Román · Químico Farmacéutico · regulamed.cl
        </div>
      </div>
    ),
    size
  );
}
