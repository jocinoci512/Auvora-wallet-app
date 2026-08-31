const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/web',
  rootDir: __dirname,
  testEnvironment: 'node',
  // pnpm nests ESM packages under .pnpm/@scope+pkg@version/… — allow transform.
  transformIgnorePatterns: ['/node_modules/(?!(?:\\.pnpm/)?(?:@noble|@scure|.*@noble|.*@scure)/)'],
};
