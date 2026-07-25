/**
 * One-shot scaffold generator for Auvora Wallet Phase 1 foundation.
 * Run: node scripts/scaffold-foundation.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function write(rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content.replace(/\r?\n/g, '\n'), 'utf8');
}

function writeJson(rel, obj) {
  write(rel, `${JSON.stringify(obj, null, 2)}\n`);
}

const services = [
  { name: 'gateway', port: 3000, swagger: true },
  { name: 'auth', port: 3001, swagger: false },
  { name: 'wallet', port: 3002, swagger: false },
  { name: 'blockchain', port: 3003, swagger: false },
  { name: 'payments', port: 3004, swagger: false },
  { name: 'compliance', port: 3005, swagger: false },
  { name: 'notifications', port: 3006, swagger: false },
  { name: 'analytics', port: 3007, swagger: false },
  { name: 'ai', port: 3008, swagger: false },
];

const apps = [
  { name: 'web', port: 3100, title: 'Auvora Wallet' },
  { name: 'admin', port: 3101, title: 'Auvora Admin' },
  { name: 'docs', port: 3102, title: 'Auvora Docs' },
];

// ---------------------------------------------------------------------------
// packages/config
// ---------------------------------------------------------------------------
writeJson('packages/config/package.json', {
  name: '@auvora/config',
  version: '0.1.0',
  private: true,
  type: 'module',
  exports: {
    './eslint/base': './eslint/base.js',
    './eslint/next': './eslint/next.js',
    './eslint/nest': './eslint/nest.js',
    './tsconfig/base.json': './tsconfig/base.json',
    './tsconfig/next.json': './tsconfig/next.json',
    './tsconfig/nest.json': './tsconfig/nest.json',
    './tsconfig/library.json': './tsconfig/library.json',
    './jest/node': './jest/node.cjs',
    './prettier': './prettier.mjs',
  },
  files: ['eslint', 'tsconfig', 'jest', 'prettier.mjs'],
  dependencies: {
    '@eslint/js': '^9.22.0',
    'eslint-config-prettier': '^10.1.1',
    'eslint-plugin-react': '^7.37.4',
    'eslint-plugin-react-hooks': '^5.2.0',
    globals: '^16.0.0',
    'typescript-eslint': '^8.26.1',
  },
  peerDependencies: {
    eslint: '^9.22.0',
    typescript: '^5.8.0',
  },
});

write(
  'packages/config/tsconfig/base.json',
  `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true
  }
}
`,
);

write(
  'packages/config/tsconfig/library.json',
  `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
`,
);

write(
  'packages/config/tsconfig/next.json',
  `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "allowJs": false,
    "incremental": true
  }
}
`,
);

write(
  'packages/config/tsconfig/nest.json',
  `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node", "jest"]
  }
}
`,
);

write(
  'packages/config/eslint/base.js',
  `import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export const baseConfig = [
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/prisma/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  eslintConfigPrettier,
];

export default baseConfig;
`,
);

write(
  'packages/config/eslint/next.js',
  `import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { baseConfig } from './base.js';

/** @type {import('eslint').Linter.Config[]} */
export const nextConfig = [
  ...baseConfig,
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
];

export default nextConfig;
`,
);

write(
  'packages/config/eslint/nest.js',
  `import { baseConfig } from './base.js';

/** @type {import('eslint').Linter.Config[]} */
export const nestConfig = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
];

export default nestConfig;
`,
);

write(
  'packages/config/jest/node.cjs',
  `/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts'],
  transform: {
    '^.+\\\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/main.ts'],
  coverageDirectory: 'coverage',
  clearMocks: true,
};
`,
);

write(
  'packages/config/prettier.mjs',
  `/** @type {import('prettier').Config} */
const config = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  bracketSpacing: true,
};

export default config;
`,
);

// Root eslint
write(
  'eslint.config.mjs',
  `import { baseConfig } from '@auvora/config/eslint/base';

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
`,
);

// ---------------------------------------------------------------------------
// packages/types
// ---------------------------------------------------------------------------
writeJson('packages/types/package.json', {
  name: '@auvora/types',
  version: '0.1.0',
  private: true,
  type: 'module',
  main: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      require: './dist/index.cjs',
      default: './dist/index.js',
    },
  },
  scripts: {
    build: 'tsup src/index.ts --format esm,cjs --dts --clean',
    dev: 'tsup src/index.ts --format esm,cjs --dts --watch',
    lint: 'eslint .',
    typecheck: 'tsc -p tsconfig.json --noEmit',
    test: 'jest --passWithNoTests',
    clean: 'rimraf dist coverage .turbo',
  },
  devDependencies: {
    '@auvora/config': 'workspace:*',
    '@types/jest': '^29.5.14',
    eslint: '^9.22.0',
    jest: '^29.7.0',
    rimraf: '^6.0.1',
    'ts-jest': '^29.2.6',
    tsup: '^8.4.0',
    typescript: '^5.8.2',
  },
});

write(
  'packages/types/tsconfig.json',
  `{
  "extends": "@auvora/config/tsconfig/library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "**/*.test.ts", "**/*.spec.ts"]
}
`,
);

write(
  'packages/types/eslint.config.mjs',
  `import { baseConfig } from '@auvora/config/eslint/base';

export default [...baseConfig];
`,
);

write(
  'packages/types/jest.config.cjs',
  `const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/types',
  rootDir: __dirname,
};
`,
);

write(
  'packages/types/src/index.ts',
  `export enum HealthStatus {
  Ok = 'ok',
  Degraded = 'degraded',
  Unhealthy = 'unhealthy',
}

export interface HealthCheckResponse {
  status: HealthStatus;
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  checks?: Record<string, HealthStatus>;
}

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}
`,
);

write(
  'packages/types/src/result.test.ts',
  `import { err, isErr, isOk, ok } from './index';

describe('Result helpers', () => {
  it('creates successful results', () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(42);
    }
  });

  it('creates error results', () => {
    const result = err(new Error('boom'));
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('boom');
    }
  });
});
`,
);

// ---------------------------------------------------------------------------
// packages/security
// ---------------------------------------------------------------------------
writeJson('packages/security/package.json', {
  name: '@auvora/security',
  version: '0.1.0',
  private: true,
  type: 'module',
  main: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      require: './dist/index.cjs',
      default: './dist/index.js',
    },
  },
  scripts: {
    build: 'tsup src/index.ts --format esm,cjs --dts --clean',
    dev: 'tsup src/index.ts --format esm,cjs --dts --watch',
    lint: 'eslint .',
    typecheck: 'tsc -p tsconfig.json --noEmit',
    test: 'jest',
    clean: 'rimraf dist coverage .turbo',
  },
  dependencies: {
    '@auvora/types': 'workspace:*',
  },
  devDependencies: {
    '@auvora/config': 'workspace:*',
    '@types/jest': '^29.5.14',
    '@types/node': '^22.13.10',
    eslint: '^9.22.0',
    jest: '^29.7.0',
    rimraf: '^6.0.1',
    'ts-jest': '^29.2.6',
    tsup: '^8.4.0',
    typescript: '^5.8.2',
  },
});

write(
  'packages/security/tsconfig.json',
  `{
  "extends": "@auvora/config/tsconfig/library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node", "jest"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "**/*.test.ts", "**/*.spec.ts"]
}
`,
);

write(
  'packages/security/eslint.config.mjs',
  `import { baseConfig } from '@auvora/config/eslint/base';

export default [...baseConfig];
`,
);

write(
  'packages/security/jest.config.cjs',
  `const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/security',
  rootDir: __dirname,
};
`,
);

write(
  'packages/security/src/index.ts',
  `export const SECURITY_HEADERS = {
  contentTypeOptions: 'nosniff',
  frameOptions: 'DENY',
  referrerPolicy: 'no-referrer',
  permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
} as const;

export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function assertNonEmptySecret(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(\`Missing required secret: \${name}\`);
  }
  return value;
}

export function redactSensitive(value: string, visible = 4): string {
  if (value.length <= visible * 2) {
    return '*'.repeat(value.length);
  }
  return \`\${value.slice(0, visible)}\${'*'.repeat(Math.max(4, value.length - visible * 2))}\${value.slice(-visible)}\`;
}
`,
);

write(
  'packages/security/src/timing-safe.test.ts',
  `import { redactSensitive, timingSafeEqualString } from './index';

describe('security helpers', () => {
  it('compares equal strings', () => {
    expect(timingSafeEqualString('alpha', 'alpha')).toBe(true);
    expect(timingSafeEqualString('alpha', 'beta')).toBe(false);
    expect(timingSafeEqualString('alpha', 'alphas')).toBe(false);
  });

  it('redacts secrets', () => {
    expect(redactSensitive('supersecretvalue')).toMatch(/^supe/);
    expect(redactSensitive('supersecretvalue')).toMatch(/alue$/);
    expect(redactSensitive('ab')).toBe('**');
  });
});
`,
);

console.log('Partial scaffold written (config, types, security). Continuing...');
