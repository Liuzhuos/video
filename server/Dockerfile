# ---- 构建阶段 ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

# 生成 Prisma Client
RUN npx prisma generate

RUN npm run build

# ---- 运行阶段 ----
FROM node:20-alpine

WORKDIR /app

# ffmpeg 依赖（fluent-ffmpeg 需要系统级 ffmpeg）
RUN apk add --no-cache ffmpeg

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# uploads 目录（如有本地文件需求）
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

EXPOSE 3001

CMD ["node", "dist/index.js"]
