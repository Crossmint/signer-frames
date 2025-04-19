/**
 * Generate Subresource Integrity (SRI) hash for bundled scripts
 * This script generates SHA-384 hashes for the production bundle
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// Files to generate SRI hashes for
const files = [
  {
    path: path.join(__dirname, "..", "dist", "bundle.min.js"),
    name: "Production bundle",
  },
  {
    path: path.join(__dirname, "..", "dist", "bundle.js"),
    name: "Development bundle",
  },
];

// Generate SRI hash
function generateSRI(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      console.log(
        'Please run "pnpm build:prod" first to generate the bundle files.'
      );
      return null;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash("sha384");
    hashSum.update(fileBuffer);

    return `sha384-${hashSum.digest("base64")}`;
  } catch (error) {
    console.error(`Error generating SRI for ${filePath}:`, error);
    return null;
  }
}

// Main function
(function main() {
  let hasErrors = false;
  console.log("Generating SRI hashes...\n");

  for (const file of files) {
    const hash = generateSRI(file.path);

    if (hash) {
      console.log(`${file.name}:`);
      console.log(`integrity="${hash}"`);
      console.log("\nHTML Integration:");
      console.log(
        `<script src="${path.basename(
          file.path
        )}" integrity="${hash}" crossorigin="anonymous"></script>`
      );
      console.log("\n-------------------\n");
    } else {
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.log("\nSome errors occurred. Please check the messages above.");
    process.exit(1);
  }
})();
