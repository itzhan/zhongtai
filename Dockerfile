# syntax=docker/dockerfile:1.7

FROM node:22-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/data/app.db

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# prisma 目录里除了 schema 还有 init.sql —— migrate.mjs 靠它建表
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
# seed.mjs 要用 bcryptjs 生成初始密码 hash; standalone 不一定会带上它
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder /app/scripts ./scripts
RUN mkdir -p /app/data

EXPOSE 3100
# 启动时先建表/补列, 再播种初始账号, 两者都幂等, 失败不阻塞 server。
CMD ["sh", "-c", "node scripts/migrate.mjs || true; node scripts/seed.mjs || true; exec node server.js"]
