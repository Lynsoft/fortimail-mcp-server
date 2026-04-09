# syntax=docker/dockerfile:1.7
# FortiMail MCP Server — production image (Streamable HTTP MCP, non-root, minimal attack surface)
#
# Required at runtime (set via orchestrator secrets / env, never bake into image):
#   FORTIMAIL_ENGINE_URL, FORTIMAIL_ENGINE_API_KEY
# Strongly recommended for any network exposure:
#   MCP_HTTP_BEARER_TOKEN and/or MCP_HTTP_API_KEY (otherwise POST /mcp is open — see src/http-auth.ts)

# -----------------------------------------------------------------------------
# Build
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

RUN pnpm run build && rm -rf node_modules/.cache

# -----------------------------------------------------------------------------
# Production runtime
# -----------------------------------------------------------------------------
FROM node:22-alpine AS production

LABEL org.opencontainers.image.title="fortimail-mcp-server" \
      org.opencontainers.image.description="MCP server for FortiMail Engine API (HTTP transport)" \
      org.opencontainers.image.vendor="fortimail-mcp-server"

ENV NODE_ENV=production \
    TRANSPORT=http \
    PORT=3000 \
    MCP_HTTP_HOST=0.0.0.0 \
    NODE_NO_WARNINGS=1

WORKDIR /app

# dumb-init: correct SIGTERM/SIGINT forwarding when PID 1 is Node
# Upgrade base packages for published CVEs (rebuild image periodically)
RUN apk add --no-cache dumb-init \
    && apk upgrade --no-cache \
    && rm -rf /var/cache/apk/*

# Fixed UID/GID for RBAC, volume mounts, and Kubernetes securityContext
RUN addgroup -g 65532 -S nonroot && adduser -S -D -H -u 65532 -G nonroot nonroot

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile \
    && pnpm store prune \
    && chown -R nonroot:nonroot /app

COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --chown=nonroot:nonroot public ./public

USER nonroot

EXPOSE 3000

# Uses Node stdlib only (no curl/wget in image)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

STOPSIGNAL SIGTERM

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
