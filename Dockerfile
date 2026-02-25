# Build stage — node 20-alpine
FROM node:20-alpine@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Runtime stage — caddy:alpine
FROM caddy:alpine@sha256:3b2a0196e0687279c14c27adff9fc6b44acfa318dbb97eaebe385bdf99e5364c
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
RUN adduser -D -u 1001 caddyuser \
    && chown -R caddyuser:caddyuser /srv /etc/caddy /data /config
USER caddyuser
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO /dev/null http://localhost:80/ || exit 1
