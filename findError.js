const fs = require('fs');
const h = fs.readFileSync('public/index.html', 'utf8');
const match = h.match(/<script>([\s\S]*)<\/script>/);
if (match) {
  const lines = match[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    try {
      new Function(lines.slice(0, i + 1).join('\n'));
    } catch(e) {
      if (e.message !== 'Invalid or unexpected token' && 
          e.message !== 'Unexpected end of input' &&
          !e.message.includes('Unexpected token')) continue;
      // Try to narrow down
      const chunk = lines.slice(Math.max(0, i-2), i+2);
      console.log(`Error near script line ${i+1}:`);
      chunk.forEach((l, j) => console.log(`  ${i-1+j}: ${l}`));
      break;
    }
  }
}
