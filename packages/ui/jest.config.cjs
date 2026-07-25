const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/ui',
  rootDir: __dirname,
  testEnvironment: 'node',
};
