FROM node:20-slim AS builder

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

# Copy web package
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/crypto/ ./packages/crypto/
COPY packages/database/ ./packages/database/
COPY apps/web/ ./apps/web/

# Build packages
RUN pnpm --filter @botanswer/crypto build
RUN pnpm --filter @botanswer/database exec prisma generate
RUN pnpm --filter @botanswer/database build
RUN pnpm --filter @botanswer/web build

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
COPY apps/web/package.json ./apps/web/

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Generate Prisma client
RUN pnpm --filter @botanswer/database exec prisma generate

# Copy built files
COPY --from=builder /app/packages/crypto/dist ./packages/crypto/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "start"]
