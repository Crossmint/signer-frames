#!/bin/bash

# Script to replace template variables in HTML template files with environment variables

# Default directory containing templates
TEMPLATE_DIR="static"

# Process command line arguments for environment variables
for arg in "$@"; do
    # Extract variable name and value using parameter expansion
    var_name="${arg%%=*}"
    var_value="${arg#*=}"

    echo "Setting $var_name to $var_value"

    # Find all .template files and replace variables
    find "$TEMPLATE_DIR" -name "*.template" | while read -r template_file; do
        output_file="${template_file%.template}"

        # Create a copy of the template
        cp "$template_file" "$output_file"

        # Replace the variable placeholder with its value
        sed -i '' "s|{{$var_name}}|$var_value|g" "$output_file"

        echo "Processed $template_file -> $output_file"
    done
done

# If no arguments provided, simply copy all templates without replacements
if [ "$#" -eq 0 ]; then
    echo "No environment variables provided, creating files without replacements"
    find "$TEMPLATE_DIR" -name "*.template" | while read -r template_file; do
        output_file="${template_file%.template}"
        cp "$template_file" "$output_file"
        echo "Copied $template_file -> $output_file"
    done
fi

echo "Template processing complete"
