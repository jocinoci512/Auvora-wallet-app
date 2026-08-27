const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/vault-crypto',
  rootDir: __dirname,
};
