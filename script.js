const fs = require('fs');
const content = fs.readFileSync('components/Settings.tsx', 'utf8');
const fixed = content.replace(/\\`/g, '`');
fs.writeFileSync('components/Settings.tsx', fixed);
