const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/web',
  rootDir: __dirname,
  testEnvironment: 'node',
};
