const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
const sep = h.includes('\r\n') ? '\r\n' : '\n';
const lines = h.split(sep);

// Show lines 1620-1635
console.log('Current structure:');
for (let i = 1619; i < 1635; i++) {
  console.log(`Line ${i+1}: ${lines[i]}`);
}

// The structure should be:
// </label>        <- last permission
// </div>          <- close scrollable div
// <div>Cancel/Save buttons</div>  <- save buttons INSIDE modal
// </div>          <- close .modal div
// </div>          <- close .modal-overlay div

// Find the save button lines and move them before the closing modal div
// Lines 1627-1631 are the save button div
// Line 1625 is the closing </div> of .modal

// Remove save button from current position (lines 1627-1631, index 1626-1630)
const saveButtonLines = lines.splice(1626, 5);
console.log('\nRemoved:', saveButtonLines);

// Now insert BEFORE what was line 1625 (now line 1624 after splice, closing .modal div)
// Find the closing </div> of modal
let insertAt = -1;
for (let i = 1622; i < 1630; i++) {
  if (lines[i] && lines[i].trim() === '</div>' && 
      lines[i+1] && lines[i+1].trim() === '') {
    insertAt = i;
    break;
  }
}

if (insertAt === -1) {
  // fallback - insert at line 1624
  insertAt = 1623;
}

console.log('Inserting save button at line', insertAt + 1);
lines.splice(insertAt, 0, ...saveButtonLines);

const result = lines.join(sep);
fs.writeFileSync('public/index.html', result, 'utf8');

console.log('\nNew structure:');
for (let i = 1619; i < 1638; i++) {
  console.log(`Line ${i+1}: ${lines[i]}`);
}
console.log('✅ Done!');
