const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
const sep = h.includes('\r\n') ? '\r\n' : '\n';
const lines = h.split(sep);

// Find line 1620 (index 1619) - the empty line after last checkbox
// Insert the missing buttons and closing tags before the import modal comment
const insertAt = 1619; // 0-indexed, after line 1619 (the empty line)

const toInsert = [
  '    </div>',  // close permissions div
  '',
  '    <div style="display:flex;gap:0.5rem;margin-top:1rem">',
  '      <button class="btn btn-outline" style="flex:1" onclick="closeModal(\'user-modal\')">Cancel</button>',
  '      <button class="btn btn-primary" style="flex:1" onclick="saveUser()">Save User</button>',
  '    </div>',
  '  </div>',   // close .modal
  '</div>',     // close .modal-overlay
  '',
];

lines.splice(insertAt, 0, ...toInsert);

const result = lines.join(sep);
fs.writeFileSync('public/index.html', result, 'utf8');

// Verify
const verify = fs.readFileSync('public/index.html', 'utf8').split(sep);
console.log('Lines around insertion:');
for (let i = 1617; i < 1632; i++) {
  console.log(`Line ${i+1}: ${verify[i]}`);
}
console.log('\n✅ Done!');
