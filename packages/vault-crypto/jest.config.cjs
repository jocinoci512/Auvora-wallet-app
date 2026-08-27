const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/vault-crypto',
  rootDir: __dirname,
  // Package is "type": "module" with `.js` import specifiers. Force CJS transform
  // (same effective style as wallet-service: isolatedModules + ts-jest, no native ESM).
  extensionsToTreatAsEsm: [],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          esModuleInterop: true,
          isolatedModules: true,
        },
        isolatedModules: true,
        useESM: false,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
