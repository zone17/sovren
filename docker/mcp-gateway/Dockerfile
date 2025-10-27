FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime

# Security hardening
RUN addgroup -g 1001 -S mcp && \
    adduser -u 1001 -S mcp -G mcp && \
    apk add --no-cache dumb-init curl && \
    apk del --no-cache apk-tools

WORKDIR /app

# Copy application files
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=mcp:mcp src ./src
COPY --chown=mcp:mcp package*.json ./
COPY --chown=mcp:mcp healthcheck.js ./

# Create log directory
RUN mkdir -p /var/log/mcp && chown mcp:mcp /var/log/mcp

# Security configurations
USER mcp
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node healthcheck.js

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
