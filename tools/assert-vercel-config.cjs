const fs = require('fs');
const path = require('path');

const vercelPath = path.join(__dirname, '..', 'vercel.json');
const content = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

if (content.version !== 2) {
  throw new Error(`Expected version 2, received ${content.version}`);
}

if (content.outputDirectory !== 'kod/dist') {
  throw new Error(`Expected outputDirectory "kod/dist", received ${content.outputDirectory}`);
}

const expectedRoute = { src: '/api/(.*)', dest: '/api/$1' };
if (!Array.isArray(content.routes) || content.routes.length !== 1) {
  throw new Error('Expected routes to contain exactly one entry');
}

const [route] = content.routes;
if (route.src !== expectedRoute.src || route.dest !== expectedRoute.dest) {
  throw new Error('Route entry does not match expected API passthrough');
}

console.log('vercel.json configuration is valid.');
