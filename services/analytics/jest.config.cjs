const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/analytics-service',
  rootDir: __dirname,
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
