const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');

// Detect line ending
const hasCRLF = h.includes('\r\n');
console.log('Line endings:', hasCRLF ? 'CRLF (Windows)' : 'LF (Unix)');

const sep = hasCRLF ? '\r\n' : '\n';
const lines = h.split(sep);

// Find the exact line
let foundAt = -1;
lines.forEach((l, i) => {
  if (l.includes('e.target') && l.includes('overlay') && l.includes('remove')) {
    console.log('Found at line', i + 1, ':', l.trim());
    foundAt = i;
  }
});

if (foundAt === -1) {
  console.log('❌ Line not found!');
  process.exit();
}

// Replace it
lines[foundAt] = "            if (e.target === overlay) overlay.classList.remove('open');";
console.log('Replaced with:', lines[foundAt]);

// Save with same line endings
fs.writeFileSync('public/index.html', lines.join(sep), 'utf8');

// Verify
const verify = fs.readFileSync('public/index.html', 'utf8').split(sep);
console.log('Verified:', verify[foundAt]);
console.log(!verify[foundAt].includes('[e.target]') ? '✅ Fixed!' : '❌ Still broken');
