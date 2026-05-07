const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
const sep = h.includes('\r\n') ? '\r\n' : '\n';
const lines = h.split(sep);

// Find <!-- Permissions --> comment
let permStart = -1, permEnd = -1;
for (let i = 1570; i < 1630; i++) {
  if (lines[i] && lines[i].includes('<!-- Permissions -->') && permStart === -1) {
    permStart = i;
  }
  if (permStart !== -1 && lines[i] && lines[i].trim() === '</label>' ) {
    permEnd = i; // keep updating to get the LAST </label>
  }
  if (permStart !== -1 && permEnd !== -1 && lines[i] && lines[i].includes('display:flex;gap:0.5rem;margin-top')) {
    break; // stop at save button row
  }
}

console.log('Permissions section: lines', permStart + 1, 'to', permEnd + 1);

if (permStart === -1 || permEnd === -1) {
  console.log('❌ Could not find permissions section');
  process.exit();
}

// Insert opening wrapper after <!-- Permissions --> comment
lines.splice(permStart + 1, 0, '      <div class="form-label" style="margin-bottom:0.5rem">Permissions</div>');
lines.splice(permStart + 2, 0, '      <div style="flex:1;overflow-y:auto;max-height:35vh;margin:0 -0.25rem;padding:0 0.25rem;display:flex;flex-direction:column;gap:0.4rem;margin-bottom:1rem">');

// After the splice, permEnd shifted by 2
permEnd += 2;

// Insert closing wrapper after last </label>
lines.splice(permEnd + 1, 0, '      </div>');

const result = lines.join(sep);
fs.writeFileSync('public/index.html', result, 'utf8');

// Verify
const verify = result.split(sep);
console.log('\nAround permissions:');
for (let i = permStart; i <= permStart + 5; i++) console.log(`Line ${i+1}: ${verify[i]}`);
console.log('...');
for (let i = permEnd; i <= permEnd + 3; i++) console.log(`Line ${i+1}: ${verify[i]}`);
console.log('\n✅ Done!');
