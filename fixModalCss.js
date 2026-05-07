const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
const sep = h.includes('\r\n') ? '\r\n' : '\n';
const lines = h.split(sep);

// Find and replace lines 191-198 (index 190-197)
// Find the exact range
let startIdx = -1, endIdx = -1;
for (let i = 185; i < 205; i++) {
  if (lines[i] && lines[i].trim() === '.modal-overlay {' && startIdx === -1) {
    startIdx = i;
  }
  if (startIdx !== -1 && lines[i] && lines[i].trim() === '}' && i > startIdx) {
    // Check if next non-empty line is .modal-overlay.open
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (lines[j] && (lines[j].includes('modal-overlay.open') || lines[j].includes('[modal-overlay'))) {
      endIdx = j + 2; // include the .open block closing brace
      break;
    } else {
      endIdx = i;
      break;
    }
  }
}

console.log('Found modal-overlay CSS at lines:', startIdx + 1, 'to', endIdx + 1);
console.log('Before:');
for (let i = startIdx; i <= endIdx; i++) console.log(' ', lines[i]);

// Replace with complete definition
const replacement = [
  '    .modal-overlay {',
  '      display: none;',
  '      position: fixed;',
  '      inset: 0;',
  '      background: rgba(0, 0, 0, 0.3);',
  '      z-index: 200;',
  '      align-items: flex-end;',
  '      justify-content: center;',
  '      backdrop-filter: blur(4px);',
  '    }',
  '',
  '    .modal-overlay.open {',
  '      display: flex;',
  '    }',
];

lines.splice(startIdx, endIdx - startIdx + 1, ...replacement);

const result = lines.join(sep);
fs.writeFileSync('public/index.html', result, 'utf8');

// Verify
const verify = fs.readFileSync('public/index.html', 'utf8').split(sep);
console.log('\nAfter:');
for (let i = startIdx; i <= startIdx + replacement.length - 1; i++) {
  console.log(' ', verify[i]);
}
console.log('\n✅ Done!');
