# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY public/ ./public/
COPY src/ ./src/
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY capacitor.config.ts ./
COPY package.json .env* ./
# Disable HTTPS plugin for container build (no cert file available)
ENV VITE_DISABLE_SSL=true
RUN npm run build

# ── Production stage (nginx) ───────────────────────────────────────────────────
FROM nginx:alpine

# Configure nginx to run as non-root user and generate self-signed certificates
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/nginx.key \
      -out /etc/nginx/ssl/nginx.crt \
      -subj "/C=ES/ST=Asturias/L=Gijon/O=DevorApp/CN=localhost" && \
    apk del openssl && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d /etc/nginx/ssl

USER nginx

COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080 8443
