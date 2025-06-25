FROM node:20 AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY healthcheck.sh .
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod=false

COPY . .

# Create dist directory if it doesn't exist
RUN mkdir -p dist

# Build using pnpm build script
RUN pnpm build:prod
# RUN pnpm generate-sri

FROM nginx:alpine

RUN apk add --no-cache curl

COPY --from=builder /app/dist /usr/share/nginx/html/dist
COPY --from=builder /app/css /usr/share/nginx/html/css
COPY --from=builder /app/index.html /usr/share/nginx/html/
COPY --from=builder /app/favicon.ico /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD healthcheck.sh

# Nginx container uses its own CMD to start, so we don't need to specify one
