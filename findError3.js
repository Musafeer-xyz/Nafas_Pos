const fs = require('fs');
const h = fs.readFileSync('public/index.html', 'utf8');
const match = h.match(/<script>([\s\S]*)<\/script>/);
if (!match) { console.log('No script tag'); process.exit(); }

const code = match[1];
const lines = code.split('\n');
console.log('Total lines:', lines.length);

// Try adding one line at a time from the END
// Find last line that works
let lastGood = 0;
for (let i = 100; i <= lines.length; i += 100) {
  try {
    new Function(lines.slice(0, i).join('\n'));
    lastGood = i;
  } catch (e) {
    // Error is between lastGood and i
    // Now narrow down
    for (let j = lastGood + 1; j <= i; j++) {
      try {
        new Function(lines.slice(0, j).join('\n'));
        lastGood = j;
      } catch (e2) {
        console.log('\n❌ Error at script line:', j);
        console.log('Error:', e2.message);
        const start = Math.max(0, j - 4);
        for (let k = start; k <= Math.min(j + 2, lines.length - 1); k++) {
          const marker = k === j - 1 ? '>>>' : '   ';
          console.log(`${marker} ${k + 1}: ${lines[k]}`);
        }
        // Check for non-ASCII
        const badLine = lines[j - 1];
        for (let c = 0; c < badLine.length; c++) {
          if (badLine.charCodeAt(c) > 127) {
            console.log(`  Non-ASCII at pos ${c}: code=${badLine.charCodeAt(c)} char="${badLine[c]}"`);
          }
        }
        process.exit();
      }
    }
    break;
  }
}
console.log('Last good line:', lastGood);
