const fs = require('fs');
const path = './components/Settings.tsx';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(/\\`/g, '`');
fs.writeFileSync(path, code);
console.log('Fixed escaped backticks');
