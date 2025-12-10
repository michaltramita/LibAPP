const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const expected = 'npm --prefix kod run build';

if (!packageJson.scripts || packageJson.scripts.build !== expected) {
  throw new Error(`Expected scripts.build to be "${expected}"`);
}

console.log('scripts.build is correctly set to the expected command.');
