FROM node:20 AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

# Create dist directory if it doesn't exist
RUN mkdir -p dist

# Use TypeScript directly
RUN npx tsc

# Create a temporary script to use esbuild via its JS API
RUN echo "const esbuild = require('esbuild'); \
    esbuild.build({ \
    entryPoints: ['src/index.ts'], \
    bundle: true, \
    minify: true, \
    sourcemap: true, \
    outfile: 'dist/bundle.min.js', \
    format: 'iife', \
    }).catch(() => process.exit(1));" > esbuild-script.js

RUN node esbuild-script.js

RUN pnpm generate-sri

RUN echo '#!/bin/sh \n\
    SRI_HASH=$(node -e "const fs=require(\"fs\"); \
    const crypto=require(\"crypto\"); \
    const file=fs.readFileSync(\"/app/dist/bundle.min.js\"); \
    const hash=crypto.createHash(\"sha384\").update(file).digest(\"base64\"); \
    console.log(\"sha384-\" + hash);") \n\
    sed -i "s|<script src=\"dist/bundle.min.js\"></script>|<script src=\"dist/bundle.min.js\" integrity=\"$SRI_HASH\" crossorigin=\"anonymous\"></script>|g" /usr/share/nginx/html/index.html' > /app/inject-sri.sh && chmod +x /app/inject-sri.sh

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html/dist
COPY --from=builder /app/css /usr/share/nginx/html/css
COPY --from=builder /app/index.html /usr/share/nginx/html/
COPY --from=builder /app/favicon.ico /usr/share/nginx/html/
COPY --from=builder /app/inject-sri.sh /docker-entrypoint.d/40-inject-sri.sh

RUN chmod +x /docker-entrypoint.d/40-inject-sri.sh

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
    add_header X-Frame-Options SAMEORIGIN; \
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
    # Handle 404 errors \
    error_page 404 /index.html; \
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

# Nginx container uses its own CMD to start, so we don't need to specify one
