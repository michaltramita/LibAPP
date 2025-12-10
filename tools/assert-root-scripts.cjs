const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const expectedPostinstall = 'npm --prefix kod install';
const expectedBuild = 'npm --prefix kod run build';

if (!packageJson.scripts || packageJson.scripts.postinstall !== expectedPostinstall) {
  throw new Error(`Expected scripts.postinstall to be "${expectedPostinstall}"`);
}

if (packageJson.scripts.build !== expectedBuild) {
  throw new Error(`Expected scripts.build to be "${expectedBuild}"`);
}

console.log('Root scripts are correctly configured.');
