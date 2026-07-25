import { baseConfig } from '@auvora/config/eslint/base';

export default [
  ...baseConfig,
  {
    ignores: [
      'apps/**',
      'services/**',
      'packages/**',
      'database/**',
      'infrastructure/**',
      'scripts/**',
      '.tools/**',
    ],
  },
];
