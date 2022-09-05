const concat = require('concat');

concat(
  ['./src/Query.js', './src/Schema.js', './src/Table.js', './src/Database.js'],
  './dist/bundle.js'
);
