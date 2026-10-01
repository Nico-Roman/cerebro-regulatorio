import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway ejecuta la app como proceso Node persistente. `standalone` emite
  // un server.js con solo las dependencias que el trazado detecta, para que la
  // imagen no cargue node_modules completo (ver Dockerfile).
  output: "standalone",

  // No anunciar el framework ni su versión en cada respuesta. No detiene a
  // nadie decidido, pero deja de regalar la pista de qué exploit probar.
  poweredByHeader: false,

  images: {
    // Portada del VSL. Va con `unoptimized` en el componente (no tiene sentido
    // pasar por el optimizador una miniatura que YouTube ya sirve en el tamaño
    // justo), pero el host igual tiene que estar declarado o next/image lo
    // rechaza en build.
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }],
  },

  async redirects() {
    return [
      // Un solo dominio: www respondía 200 y duplicaba el sitio para Google.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.regulamed.cl" }],
        destination: "https://regulamed.cl/:path*",
        permanent: true,
      },
      // /planes deja de existir con el cobro por uso.
      { source: "/planes", destination: "/normativa", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Dos años de HTTPS obligado. Sin `includeSubDomains` ni `preload` a
          // propósito: ambos son difíciles de revertir (el navegador recuerda la
          // regla aunque se quite la cabecera) y aplicarían a subdominios que
          // hoy no existen y podrían no servirse por Railway.
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          // El sitio no usa cámara, micrófono, ubicación ni pagos. Declararlo
          // vacío hace que un script inyectado tampoco pueda pedirlos.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
