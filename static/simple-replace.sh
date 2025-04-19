#!/bin/bash

# A simplified script to replace template variables

# Source the .env.local file
set -a
source .env.local
set +a

echo "Creating index.html from template..."

# Copy the template
cp static/index.html.tpl static/index.html

# Replace each variable
sed -i '' "s|{{API_URL}}|$API_URL|g" static/index.html
sed -i '' "s|{{ENVIRONMENT}}|$ENVIRONMENT|g" static/index.html
sed -i '' "s|{{APP_TITLE}}|$APP_TITLE|g" static/index.html
sed -i '' "s|{{APP_VERSION}}|$APP_VERSION|g" static/index.html
sed -i '' "s|{{THEME}}|$THEME|g" static/index.html
sed -i '' "s|{{STORAGE_PREFIX}}|$STORAGE_PREFIX|g" static/index.html

echo "✅ Done! Template variables replaced in static/index.html"
