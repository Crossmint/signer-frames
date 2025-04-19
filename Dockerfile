FROM node:18-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy source files
COPY src/ ./src/
COPY static/ ./static/

# Create necessary directories
RUN mkdir -p dist static/js/dist

# Build the bundle
RUN pnpm run build:prod

# Copy the template replacement script
RUN cp static/replace-template.sh ./replace-template.sh
RUN chmod +x ./replace-template.sh

FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files from builder
COPY --from=builder /app/static /usr/share/nginx/html

# Copy the template replacement script
COPY --from=builder /app/replace-template.sh /usr/bin/replace-template.sh
RUN chmod +x /usr/bin/replace-template.sh

# Copy and set up the entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
