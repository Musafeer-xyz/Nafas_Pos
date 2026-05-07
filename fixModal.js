const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
const sep = h.includes('\r\n') ? '\r\n' : '\n';
const lines = h.split(sep);

// Fix 1: Line 896 - replace entire line
console.log('Line 896 before:', lines[895]);
lines[895] = '    .modal-overlay.open {';
console.log('Line 896 after:', lines[895]);

// Fix 2: Line 1617 - remove z-index:300 from import-modal
lines.forEach((l, i) => {
  if (l.includes('id="import-modal"') && l.includes('z-index:300')) {
    console.log('Found import-modal at line', i + 1);
    lines[i] = l.replace(' style="z-index:300"', '');
    console.log('Fixed to:', lines[i].trim());
  }
});

fs.writeFileSync('public/index.html', lines.join(sep), 'utf8');

// Verify
const verify = fs.readFileSync('public/index.html', 'utf8').split(sep);
console.log('\nVerify line 896:', verify[895]);
console.log('Import modal fixed:', !verify.some(l => l.includes('import-modal') && l.includes('z-index:300')) ? '✅' : '❌');
