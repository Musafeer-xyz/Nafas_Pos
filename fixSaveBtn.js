const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
const sep = h.includes('\r\n') ? '\r\n' : '\n';
const lines = h.split(sep);

// Fix 1: Update save button div style (lines 1626-1627, index 1625-1626)
for (let i = 1620; i < 1635; i++) {
  if (lines[i] && lines[i].includes('display:flex;gap:0.5rem;margin-top:1rem')) {
    console.log('Found save button div at line', i + 1);
    lines[i] = '    <div style="display:flex;gap:0.5rem;margin-top:auto;padding-top:0.75rem;border-top:1px solid var(--border);flex-shrink:0;position:sticky;bottom:0;background:var(--card);padding-bottom:0.5rem">';
    console.log('Fixed to:', lines[i]);
    break;
  }
}

// Fix 2: Remove extra closing </div> - find the two consecutive closing divs
for (let i = 1628; i < 1638; i++) {
  if (lines[i] && lines[i].trim() === '</div>' && 
      lines[i+1] && lines[i+1].trim() === '</div>' &&
      lines[i+2] && lines[i+2].trim() === '</div>') {
    console.log('Found triple closing divs at line', i + 1);
    // Remove one extra
    lines.splice(i + 1, 1);
    console.log('Removed extra closing div');
    break;
  }
}

const result = lines.join(sep);
fs.writeFileSync('public/index.html', result, 'utf8');

// Verify
const verify = result.split(sep);
console.log('\nLines 1625-1638:');
for (let i = 1624; i < 1638; i++) console.log(`Line ${i+1}: ${verify[i]}`);
console.log('\n✅ Done!');
