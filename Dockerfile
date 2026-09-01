FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json tsconfig.json ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

# Vite needs these values while compiling. Railway environment variables are
# also available at build time when configured in the service settings.
ENV BASE_PATH=/
ENV PORT=5173
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

RUN pnpm --filter @workspace/api-server run build \
  && pnpm --filter @workspace/madara-music run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV FRONTEND_DIST_DIR=/app/public

COPY --from=builder /app/artifacts/api-server/dist ./api
COPY --from=builder /app/artifacts/madara-music/dist/public ./public

EXPOSE 8080

CMD ["node", "--enable-source-maps", "/app/api/index.mjs"]