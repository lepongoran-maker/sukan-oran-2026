const fs = require('fs');
let code = fs.readFileSync('components/Settings.tsx', 'utf8');
code = code.replace(/\\`/g, '`');
fs.writeFileSync('components/Settings.tsx', code);
console.log('Fixed escaped backticks');
