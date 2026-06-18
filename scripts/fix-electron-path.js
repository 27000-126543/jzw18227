const fs = require('fs');
const path = require('path');

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron');
const expectedPath = path.join(electronDir, 'dist', 'electron.exe');
const altPath = path.join(electronDir, 'electron.exe');

let finalPath = '';
if (fs.existsSync(expectedPath)) {
  finalPath = 'electron.exe';
  console.log('Found electron at dist/electron.exe');
} else if (fs.existsSync(altPath)) {
  finalPath = '..\\electron.exe';
  console.log('Found electron at electron.exe');
} else {
  console.error('Could not find electron.exe in:', expectedPath, 'or', altPath);
  process.exit(1);
}

fs.writeFileSync(path.join(electronDir, 'path.txt'), finalPath, { encoding: 'utf8' });
console.log('Wrote path.txt:', finalPath);
console.log('Verify content:', fs.readFileSync(path.join(electronDir, 'path.txt'), 'utf8'));
