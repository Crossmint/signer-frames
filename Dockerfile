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

FROM nginx:alpine

# Copy nginx configuration
COPY static/nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files from builder
COPY --from=builder /app/static /usr/share/nginx/html

# Make the template replacement script executable
RUN chmod +x /usr/share/nginx/html/replace-template.sh

# Move the script to a common location
RUN mv /usr/share/nginx/html/replace-template.sh /usr/bin/replace-template.sh

# Copy and set up the entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
