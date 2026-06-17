const fs = require('fs');
const buildInfoPath = '/Users/babostudio/class_democra_dev/app/src/lib/build-info.js';
let buildInfo = fs.readFileSync(buildInfoPath, 'utf8');

buildInfo = buildInfo.replace(/APP_BUILD = 'v1\.2\.\d+'/g, "APP_BUILD = 'v1.2.215'");

fs.writeFileSync(buildInfoPath, buildInfo);
console.log("Updated build-info.js to v1.2.215");
