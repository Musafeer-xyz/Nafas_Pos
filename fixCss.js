const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');

// Find and show the problem area
const lines = h.split('\n');
console.log('Line 891 raw bytes:');
const line = lines[890];
for (let i = 0; i < line.length; i++) {
  process.stdout.write(`[${line.charCodeAt(i)}:${line[i]}]`);
}
console.log('\n');

// Replace line 891 entirely
lines[890] = '    .modal-overlay.open {';
const fixed = lines.join('\n');
fs.writeFileSync('public/index.html', fixed, 'utf8');

// Verify
const verify = fs.readFileSync('public/index.html', 'utf8').split('\n');
console.log('Line 891 is now:', verify[890]);
console.log('Done!');
