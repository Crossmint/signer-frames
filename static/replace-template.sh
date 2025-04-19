#!/bin/sh

# This script replaces template variables in the HTML and JS files
# Usage: ./replace-template.sh OUTBOUND_ENDPOINT="https://your-endpoint.com"

if [ -z "$1" ]; then
    echo "Usage: $0 OUTBOUND_ENDPOINT=\"https://your-endpoint.com\""
    exit 1
fi

# Extract variable name and value
VAR_NAME=$(echo $1 | cut -d= -f1)
VAR_VALUE=$(echo $1 | cut -d= -f2)

if [ "$VAR_NAME" = "OUTBOUND_ENDPOINT" ]; then
    # Check if main file exists
    if [ ! -f "/usr/share/nginx/html/index.html" ]; then
        echo "Error: File /usr/share/nginx/html/index.html not found"
        exit 1
    fi

    # Replace the template variable in index.html
    sed -i "s|{{OUTBOUND_ENDPOINT}}|$VAR_VALUE|g" /usr/share/nginx/html/index.html
    echo "Replaced {{OUTBOUND_ENDPOINT}} in index.html with $VAR_VALUE"

    # Find and replace in all JS files
    find /usr/share/nginx/html -name "*.js" -type f -exec sed -i "s|{{OUTBOUND_ENDPOINT}}|$VAR_VALUE|g" {} \;
    echo "Replaced {{OUTBOUND_ENDPOINT}} in all JS files with $VAR_VALUE"
else
    echo "Unknown variable: $VAR_NAME"
    exit 1
fi
