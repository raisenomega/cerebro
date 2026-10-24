# CEREBRO API — imagen de producción (Railway).
# Build determinista del monorepo pnpm; arranca el servidor HTTP de apps/cerebro.
FROM node:22-slim

WORKDIR /app
ENV HUSKY=0
RUN corepack enable

# Copia el monorepo (ver .dockerignore) e instala + compila todo el workspace.
COPY . .
RUN pnpm install --frozen-lockfile && pnpm -r build

ENV NODE_ENV=production
# Railway inyecta PORT; el server lo lee (process.env.PORT ?? 8080).
CMD ["node", "apps/cerebro/dist/http/main.js"]
