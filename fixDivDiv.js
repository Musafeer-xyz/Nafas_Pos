const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
const sep = h.includes('\r\n') ? '\r\n' : '\n';
const lines = h.split(sep);

// Fix line 1627 (index 1626) - has '<div <div'
console.log('Line 1627 before:', lines[1626]);
lines[1626] = '    <div';
console.log('Line 1627 after:', lines[1626]);

const result = lines.join(sep);
fs.writeFileSync('public/index.html', result, 'utf8');
console.log('✅ Done!');
