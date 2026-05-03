const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
if (scriptMatch) {
    try {
        new Function(scriptMatch[1]);
        console.log('✅ JS is valid - no syntax errors');
    } catch (e) {
        console.log('❌ JS Error:', e.message);
    }
} else {
    console.log('❌ No script tag found');
}