const fs = require('fs');
const path = require('path');

const xmlPath = process.argv[2];
const xml = fs.readFileSync(xmlPath, 'utf8');

const text = xml
  .replace(/<w:tab[^>]*\/>/g, '\t')
  .replace(/<w:br[^>]*\/>/g, '\n')
  .replace(/<\/w:p>/g, '\n')
  .replace(/<\/w:tr>/g, '\n')
  .replace(/<\/w:tc>/g, ' | ')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

fs.writeFileSync(path.join(__dirname, 'extracted.txt'), text, 'utf8');
console.log('OK');
