FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制 workspace 与配置
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY apps/web/package.json ./apps/web/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源码并构建 API
COPY apps/api ./apps/api
RUN pnpm -F @leyova/api build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8788
ENV HOST=0.0.0.0

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/

RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY database ./database

RUN chown -R node:node /app

USER node

EXPOSE 8788

CMD ["node", "apps/api/dist/index.js"]

