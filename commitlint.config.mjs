import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: [require.resolve('@commitlint/config-conventional')],
  rules: {
    'body-max-line-length': [2, 'always', 200],
    'footer-max-line-length': [2, 'always', 200],
  },
};

export default config;
