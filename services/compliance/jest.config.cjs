const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/compliance-service',
  rootDir: __dirname,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
