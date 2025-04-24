/**
 * Generate Subresource Integrity (SRI) hash for bundled scripts
 * This script generates SHA-384 hashes for the production bundle and adds them to index.html
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Files to generate SRI hashes for and their corresponding script reference in index.html
const files = [
  {
    path: path.join(__dirname, '..', 'dist', 'bundle.min.js'),
    name: 'Production bundle',
    htmlPattern: /<script src="dist\/bundle\.min\.js(?:\?[^"]*)?"><\/script>/,
  },
  // {
  //   path: path.join(__dirname, '..', 'dist', 'bundle.js'),
  //   name: 'Development bundle',
  //   htmlPattern: /<script src="dist\/bundle\.js(?:\?[^"]*)?"><\/script>/,
  // },
];

const INDEX_HTML_PATH = path.join(__dirname, '..', 'index.html');

// Generate SRI hash
function generateSRI(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      console.log('Please run "pnpm build:prod" first to generate the bundle files.');
      return null;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha384');
    hashSum.update(fileBuffer);

    return `sha384-${hashSum.digest('base64')}`;
  } catch (error) {
    console.error(`Error generating SRI for ${filePath}:`, error);
    return null;
  }
}

// Update the script tag in index.html with the integrity hash
function updateHtml(hash, pattern) {
  try {
    if (!fs.existsSync(INDEX_HTML_PATH)) {
      console.error(`HTML file not found: ${INDEX_HTML_PATH}`);
      return false;
    }

    const htmlContent = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    // Check if the pattern matches
    if (!pattern.test(htmlContent)) {
      console.error('Could not find script tag matching pattern in index.html');
      return false;
    }

    // Replace the script tag with one that includes the integrity attribute
    const updatedHtml = htmlContent.replace(pattern, match => {
      // If integrity already exists, replace it
      if (match.includes('integrity=')) {
        return match.replace(/integrity="[^"]*"/, `integrity="${hash}"`);
      }
      // Otherwise add integrity attribute before the closing angle bracket
      return match.replace('></script>', ` integrity="${hash}" crossorigin="anonymous"></script>`);
    });

    // Write the updated HTML back to the file
    fs.writeFileSync(INDEX_HTML_PATH, updatedHtml, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error updating HTML for ${pattern}:`, error);
    return false;
  }
}

// Main function
(function main() {
  let hasErrors = false;
  let successCount = 0;

  for (const file of files) {
    const hash = generateSRI(file.path);

    if (hash) {
      console.log(`Generated integrity hash for ${file.name}: ${hash}`);

      // Update the HTML file with the integrity hash
      if (updateHtml(hash, file.htmlPattern)) {
        console.log(`Successfully updated index.html with integrity for ${file.name}`);
        successCount++;
      } else {
        console.error(`Failed to update index.html for ${file.name}`);
        hasErrors = true;
      }
    } else {
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.log('\nSome errors occurred. Please check the messages above.');
    process.exit(1);
  } else if (successCount > 0) {
    console.log('\nSuccessfully updated all integrity hashes in index.html');
  }
})();
