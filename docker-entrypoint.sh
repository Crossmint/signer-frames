#!/bin/sh
if [ ! -z "$OUTBOUND_ENDPOINT" ]; then
    replace-template.sh OUTBOUND_ENDPOINT="$OUTBOUND_ENDPOINT"
fi
exec nginx -g "daemon off;"
