/** @type {import('jest').Config} */
module.exports = {
  displayName: '@auvora/connections-service',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  globals: {
    'ts-jest': { isolatedModules: true, tsconfig: '<rootDir>/tsconfig.json' },
  },
};
