const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');

console.log('File size before:', h.length);

// Try multiple possible encodings of the corrupted string
const variants = [
  '[e.target](http://e.target)',
  '\[e.target\](http://e.target)',
  '[e.target](http:\/\/e.target)',
];

let fixed = false;
for (const variant of variants) {
  if (h.includes(variant)) {
    h = h.replace(variant, 'e.target');
    console.log('✅ Replaced variant:', variant);
    fixed = true;
    break;
  }
}

if (!fixed) {
  // Try finding by surrounding context
  const before = "if (";
  const after = " === overlay) overlay.classList.remove('open');";
  const idx = h.indexOf(after);
  if (idx > 0) {
    // Find the 'if (' before this
    const ifIdx = h.lastIndexOf(before, idx);
    if (ifIdx > 0) {
      const corrupt = h.substring(ifIdx + 4, idx);
      console.log('Found corrupt section:', JSON.stringify(corrupt));
      console.log('Char codes:', [...corrupt].map(c => c.charCodeAt(0)));
      h = h.substring(0, ifIdx + 4) + 'e.target' + h.substring(idx);
      fixed = true;
      console.log('✅ Fixed by context search!');
    }
  }
}

if (!fixed) {
  console.log('❌ Could not find the corrupted string');
  process.exit();
}

fs.writeFileSync('public/index.html', h, 'utf8');
console.log('File size after:', h.length);

// Verify
const verify = fs.readFileSync('public/index.html', 'utf8');
console.log('Contains fix:', verify.includes("if (e.target === overlay)") ? '✅ YES' : '❌ NO');
