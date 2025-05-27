FROM node:20 AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml  ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod=false

COPY . .

# Create dist directory if it doesn't exist
RUN mkdir -p dist

# Build using pnpm build script
RUN pnpm build:prod
# RUN pnpm generate-sri

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html/dist
COPY --from=builder /app/css /usr/share/nginx/html/css
COPY --from=builder /app/index.html /usr/share/nginx/html/
COPY --from=builder /app/export.html /usr/share/nginx/html/
COPY --from=builder /app/favicon.ico /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

# Nginx container uses its own CMD to start, so we don't need to specify one
