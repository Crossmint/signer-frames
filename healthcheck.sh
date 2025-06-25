#!/bin/sh
set -e

INDEX_PAGE=$(curl -f http://localhost:8080/)

SCRIPT_URL=$(echo "$INDEX_PAGE" | grep 'dist/bundle.min.js' | sed -n 's/.*src="\([^"]*\)".*/\1/p')
INTEGRITY_HASH=$(echo "$INDEX_PAGE" | grep 'dist/bundle.min.js' | sed -n 's/.*integrity="\([^"]*\)".*/\1/p')

# If there's no integrity hash, we pass the check, as it's not enforced yet
if [ -z "$INTEGRITY_HASH" ]; then
    echo "No integrity hash found for $SCRIPT_URL. Health check passed."
    exit 0
fi

SCRIPT_CONTENT=$(curl -f "http://localhost:8080/$SCRIPT_URL")

HASH_ALGO=$(echo "$INTEGRITY_HASH" | cut -d'-' -f1)
EXPECTED_HASH=$(echo "$INTEGRITY_HASH" | cut -d'-' -f2)

# Convert sha384 to openssl's algorithm name sha384
OPENSSL_ALGO=$(echo "$HASH_ALGO" | tr '[:upper:]' '[:lower:]')

CALCULATED_HASH=$(echo -n "$SCRIPT_CONTENT" | openssl dgst -"$OPENSSL_ALGO" -binary | openssl base64 -A)

if [ "$CALCULATED_HASH" = "$EXPECTED_HASH" ]; then
    echo "SRI check passed for $SCRIPT_URL"
    exit 0
else
    echo "SRI check failed for $SCRIPT_URL"
    echo "Expected: $EXPECTED_HASH"
    echo "Got: $CALCULATED_HASH"
    exit 1
fi
