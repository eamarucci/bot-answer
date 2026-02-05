FROM node:20-slim AS builder

# Install pnpm and openssl for native modules
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy packages
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/database/package.json ./packages/database/

# Copy bot package
COPY apps/bot/package.json ./apps/bot/

# Copy npmrc for build config
COPY .npmrc ./

# Install all dependencies with native module support
ENV PNPM_ALLOW_BUILD_SCRIPTS=true
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/crypto/ ./packages/crypto/
COPY packages/database/ ./packages/database/
COPY apps/bot/ ./apps/bot/

# Build packages
RUN pnpm --filter @botanswer/crypto build
RUN pnpm --filter @botanswer/database exec prisma generate
RUN pnpm --filter @botanswer/database build
RUN pnpm --filter @botanswer/bot build

# Production stage
FROM node:20-slim

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy packages
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma/ ./packages/database/prisma/
COPY apps/bot/package.json ./apps/bot/

# Install all dependencies with native module support  
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy npmrc for build config
COPY .npmrc ./

ENV PNPM_ALLOW_BUILD_SCRIPTS=true
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @botanswer/database exec prisma generate

# Copy built files
COPY --from=builder /app/packages/crypto/dist ./packages/crypto/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist

# Create data directory
RUN mkdir -p /app/apps/bot/data

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

WORKDIR /app/apps/bot

CMD ["node", "dist/index.js"]
