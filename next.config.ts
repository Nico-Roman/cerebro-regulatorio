import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway ejecuta la app como proceso Node persistente. `standalone` emite
  // un server.js con solo las dependencias que el trazado detecta, para que la
  // imagen no cargue node_modules completo (ver Dockerfile).
  output: "standalone",

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
