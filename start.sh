#!/bin/sh

# Check if Docker and Docker Compose are available locally
use_native=true

# Check for Docker
if ! command -v docker >/dev/null 2>&1; then
    echo "Docker not found locally, will use pnpm dlx"
    use_native=false
fi

# Check for Docker Compose
if [ "$use_native" = true ] && ! command -v docker-compose >/dev/null 2>&1; then
    # Check if Docker Compose is available via Docker Compose plugin
    if ! docker compose version >/dev/null 2>&1; then
        echo "Docker Compose not found locally, will use pnpm dlx"
        use_native=false
    else
        # Use Docker Compose V2 format
        compose_cmd="docker compose"
    fi
else
    compose_cmd="docker-compose"
fi

# Build and start the container
echo "Building and starting the container..."

if [ "$use_native" = true ]; then
    echo "Using locally installed Docker and Docker Compose"
    $compose_cmd up --build
else
    echo "Using Docker and Docker Compose via pnpm dlx"
    pnpm dlx docker-compose up --build
fi

# If the container fails to start, provide debugging information
if [ $? -ne 0 ]; then
    echo "Container failed to start. Here's some debugging information:"

    if [ "$use_native" = true ]; then
        $compose_cmd logs
        echo "\nTrying to run the container with an explicit command instead of entrypoint..."
        $compose_cmd down
        docker build -t crossmint-signer-enclave .
        docker run -p 8080:8080 crossmint-signer-enclave sh -c "sh /docker-entrypoint.sh"
    else
        pnpm dlx docker-compose logs
        echo "\nTrying to run the container with an explicit command instead of entrypoint..."
        pnpm dlx docker-compose down
        pnpm dlx docker build -t crossmint-signer-enclave .
        pnpm dlx docker run -p 8080:8080 crossmint-signer-enclave sh -c "sh /docker-entrypoint.sh"
    fi
fi
