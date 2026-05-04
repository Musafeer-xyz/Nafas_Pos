const fs = require('fs');
const h = fs.readFileSync('public/index.html', 'utf8');
const match = h.match(/<script>([\s\S]*)<\/script>/);
if (!match) { console.log('No script tag found'); process.exit(); }

const code = match[1];
const lines = code.split('\n');
console.log('Total script lines:', lines.length);

// Binary search for the error
let lo = 0, hi = lines.length;
while (lo < hi) {
  const mid = Math.floor((lo + hi) / 2);
  try {
    new Function(lines.slice(0, mid).join('\n'));
    lo = mid + 1;
  } catch(e) {
    hi = mid;
  }
}

console.log('Error at or before script line:', lo);
// Show context
const start = Math.max(0, lo - 5);
const end = Math.min(lines.length, lo + 3);
for (let i = start; i < end; i++) {
  const marker = i === lo - 1 ? '>>>' : '   ';
  console.log(`${marker} Line ${i+1}: ${lines[i]}`);
}

// Show char codes of the problem line
if (lo > 0) {
  const problemLine = lines[lo - 1];
  console.log('\nChar codes of problem line:');
  for (let i = 0; i < Math.min(problemLine.length, 50); i++) {
    const code = problemLine.charCodeAt(i);
    if (code > 127) console.log(`  Position ${i}: charCode=${code} char="${problemLine[i]}"`);
  }
  if ([...problemLine].every(c => c.charCodeAt(0) <= 127)) {
    console.log('  (all ASCII - problem may be in surrounding context)');
  }
}
