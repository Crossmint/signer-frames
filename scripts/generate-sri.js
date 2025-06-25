const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');

const BUNDLE_PATH = path.join(__dirname, '..', 'dist', 'bundle.min.js');
const HTML_PATH = path.join(__dirname, '..', 'index.html');

function generateSri(filePath) {
  const fileData = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha384').update(fileData).digest('base64');
  return `sha384-${hash}`;
}

function updateHtml(htmlPath, sriHash) {
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(htmlContent);
  const { document } = dom.window;

  const scriptElement = document.querySelector('script[src="dist/bundle.min.js"]');

  if (scriptElement) {
    scriptElement.setAttribute('integrity', sriHash);
    scriptElement.setAttribute('crossorigin', 'anonymous');

    const newHtmlContent = dom.serialize();
    fs.writeFileSync(htmlPath, newHtmlContent, 'utf8');
    console.log(`Successfully added SRI hash to ${path.basename(htmlPath)}`);
  } else {
    console.error('Could not find script tag for "dist/bundle.min.js" in index.html.');
    process.exit(1);
  }
}

try {
  const sriHash = generateSri(BUNDLE_PATH);
  updateHtml(HTML_PATH, sriHash);
} catch (error) {
  console.error('Failed to generate or apply SRI hash:', error);
  process.exit(1);
}
