const fs = require('fs');

const data = fs.readFileSync('components/Settings.tsx', 'utf8');
const fixed = data.replace(/\\\`/g, '`');
fs.writeFileSync('components/Settings.tsx', fixed);
console.log('Fixed Settings.tsx');
