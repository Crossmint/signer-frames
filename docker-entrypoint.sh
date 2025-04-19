#!/bin/sh

# Handle all environment variables that should be passed to templates
ENV_VARS=""

# Add OUTBOUND_ENDPOINT if it exists (for backward compatibility)
if [ ! -z "$OUTBOUND_ENDPOINT" ]; then
    ENV_VARS="$ENV_VARS OUTBOUND_ENDPOINT=\"$OUTBOUND_ENDPOINT\""
fi

# Add API_URL if it exists
if [ ! -z "$API_URL" ]; then
    ENV_VARS="$ENV_VARS API_URL=\"$API_URL\""
fi

# Add ENVIRONMENT if it exists
if [ ! -z "$ENVIRONMENT" ]; then
    ENV_VARS="$ENV_VARS ENVIRONMENT=\"$ENVIRONMENT\""
fi

# Process any other custom environment variables
# This will catch any env var that starts with TEMPLATE_
for envvar in $(env | grep ^TEMPLATE_ | cut -d= -f1); do
    ENV_VARS="$ENV_VARS $envvar=\"$(eval echo \$$envvar)\""
done

# Run the template replacement script if we have variables to replace
if [ ! -z "$ENV_VARS" ]; then
    echo "Applying template variables: $ENV_VARS"
    eval "replace-template.sh $ENV_VARS"
else
    # Run with no args to just copy templates without replacements
    replace-template.sh
fi

# Start nginx
exec nginx -g "daemon off;"
