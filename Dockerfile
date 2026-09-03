# syntax=docker/dockerfile:1
# Imagen de producción de RegulaMED para Railway.
# Tres etapas para que la imagen final no arrastre node_modules de desarrollo:
# deps instala, builder compila con `output: standalone`, runner solo ejecuta.

# ── 1. Dependencias ─────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── 2. Build ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* se incrusta en el bundle durante el build, no en runtime:
# Railway pasa las variables del servicio como build args.
# El valor por defecto evita que un build sin la variable deje la cadena vacía,
# que no es lo mismo que ausente y rompía `new URL()` en el metadata.
ARG NEXT_PUBLIC_SITE_URL="https://cerebro-regulatorio.vercel.app"
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── 3. Runtime ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Railway inyecta su propia PORT (hoy 8080) y pisa este valor: esto es solo el
# defecto para correr la imagen a mano. Si cambias esto, acuérdate de que el
# "target port" del dominio en Railway tiene que apuntar al puerto real.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# El buscador lee data/corpus.jsonl con process.cwd() en runtime. El trazado
# de archivos de Next no puede detectar esa ruta (se arma dinámicamente), así
# que el corpus se copia explícitamente o el contenedor arranca sin índice.
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
