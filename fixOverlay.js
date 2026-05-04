const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
const lines = h.split('\n');

// Show current line 3276
console.log('Before:', JSON.stringify(lines[3275]));

// Replace line 3276 entirely with correct code
lines[3275] = '            if (e.target === overlay) overlay.classList.remove(\'open\');';

console.log('After:', JSON.stringify(lines[3275]));

h = lines.join('\n');
fs.writeFileSync('public/index.html', h, 'utf8');
console.log('Done!');
