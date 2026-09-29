// variante del harness que pasa origenes[] como 6to argumento
const path = require('path');
process.argv = process.argv.slice(0,2).concat(process.argv.slice(2));
require('./harness.js');
