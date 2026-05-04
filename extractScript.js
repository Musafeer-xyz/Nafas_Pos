const fs = require('fs');
const h = fs.readFileSync('public/index.html', 'utf8');
const match = h.match(/<script>([\s\S]*)<\/script>/);
if (!match) { console.log('No script tag'); process.exit(); }

// Write script to temp file
fs.writeFileSync('_temp_script.js', match[1], 'utf8');
console.log('Script extracted to _temp_script.js');
console.log('Now run: node --check _temp_script.js');
