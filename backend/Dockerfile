# Production image for the API (PostgreSQL). Build from the backend folder:
#   docker build -t kite-api ./backend

FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The production client is generated from the PostgreSQL copy of the schema (see scripts/postgres-schema.mjs).
RUN npx prisma generate --schema prisma/postgres/schema.prisma \
 && npm run build \
 && npx esbuild prisma/seed.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/seed.mjs \
 && npm prune --omit=dev

FROM node:24-alpine AS run
WORKDIR /app
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production \
    PORT=4000 \
    UPLOAD_DIR=/data/uploads
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma/postgres ./prisma/postgres
COPY --chown=node:node --chmod=755 docker-entrypoint.sh ./
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
VOLUME /data/uploads
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
