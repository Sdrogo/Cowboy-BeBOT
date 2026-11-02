# syntax=docker/dockerfile:1

# ---- Build: compila TypeScript e prepara le dipendenze di produzione ----
# L'immagine completa include già python3, make e g++, necessari a better-sqlite3
# quando non trova un binario precompilato per l'architettura del VPS.
FROM node:22-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- Runtime: solo Node, codice compilato e dipendenze di produzione ----
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    DATABASE_PATH=/app/data/cowboy-bebot.sqlite

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

# Cartella del database SQLite: va montata come volume per non perdere le schede.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]

USER node
CMD ["node", "dist/index.js"]
