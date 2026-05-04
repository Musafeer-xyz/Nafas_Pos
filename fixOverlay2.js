const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
const lines = h.split('\n');

const lineIndex = 3275; // line 3276 (0-indexed)
console.log('Before:', lines[lineIndex]);

// Replace the entire line with correct code
lines[lineIndex] = "            if (e.target === overlay) overlay.classList.remove('open');";

console.log('After:', lines[lineIndex]);

// Rejoin and save
fs.writeFileSync('public/index.html', lines.join('\n'), 'utf8');

// Verify
const verify = fs.readFileSync('public/index.html', 'utf8').split('\n');
console.log('Verified:', verify[lineIndex]);
console.log(verify[lineIndex].includes('e.target') && !verify[lineIndex].includes('[e.target]') ? '✅ Fixed!' : '❌ Still broken');
