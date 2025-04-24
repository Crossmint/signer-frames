FROM node:20 AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml  ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod=false

COPY . .

# Create dist directory if it doesn't exist
RUN mkdir -p dist

# Build using pnpm build script
RUN pnpm build:prod
RUN pnpm generate-sri

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html/dist
COPY --from=builder /app/css /usr/share/nginx/html/css
COPY --from=builder /app/index.html /usr/share/nginx/html/
COPY --from=builder /app/favicon.ico /usr/share/nginx/html/

RUN echo 'server { \
    listen 8080; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Enable gzip compression \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1000; \
    gzip_proxied expired no-cache no-store private auth; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript; \
    \
    # Security headers \
    add_header X-Content-Type-Options nosniff; \
    add_header Content-Security-Policy "frame-ancestors *"; \
    add_header Referrer-Policy strict-origin-when-cross-origin; \
    \
    # Cache control for static assets \
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico)$ { \
    expires 30d; \
    add_header Cache-Control "public, max-age=2592000"; \
    access_log off; \
    } \
    \
    # Main route \
    location / { \
    try_files $uri $uri/ /index.html; \
    } \
    \
    # Health check \
    location = /health { \
    access_log off; \
    add_header Content-Type "application/json"; \
    return 200 "{\"status\":\"OK\"}"; \
    } \
    \
    # Handle 404 errors \
    error_page 404 /index.html; \
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

# Nginx container uses its own CMD to start, so we don't need to specify one
