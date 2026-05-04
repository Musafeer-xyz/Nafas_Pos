const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');

// Extract script content
const scriptStart = h.indexOf('<script>') + 8;
const scriptEnd = h.lastIndexOf('</script>');
let script = h.substring(scriptStart, scriptEnd);

// Replace box-drawing and special chars in COMMENTS ONLY
// Process line by line - only fix comment lines
const lines = script.split('\n');
const fixed = lines.map(line => {
  const trimmed = line.trim();
  // If it's a comment line, replace all non-ASCII with safe equivalents
  if (trimmed.startsWith('//')) {
    return line
      .replace(/═/g, '=')
      .replace(/─/g, '-')
      .replace(/—/g, '-')
      .replace(/[^\x00-\x7F]/g, ''); // remove any other non-ASCII in comments
  }
  return line;
});

script = fixed.join('\n');

// Rebuild the file
const result = h.substring(0, scriptStart) + script + h.substring(scriptEnd);
fs.writeFileSync('public/index.html', result, 'utf8');
console.log('✅ Fixed! Non-ASCII chars in comments replaced.');

// Verify
try {
  new Function(script);
  console.log('✅ JS syntax is now valid!');
} catch (e) {
  console.log('❌ Still has error:', e.message);
}
