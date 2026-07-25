/**
 * One-shot scaffold generator for the Auvora Wallet monorepo foundation.
 * Run from repo root: node scripts/generate-foundation.mjs
 *
 * Skips packages/config, packages/types, packages/security, and root tooling
 * configs that already exist in the repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const written = [];

function write(rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content.replace(/\r?\n/g, '\n'), 'utf8');
  written.push(rel);
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
// packages/ui
// ---------------------------------------------------------------------------
writeJson('packages/ui/package.json', {
  name: '@auvora/ui',
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
    './styles.css': './src/styles.css',
  },
  sideEffects: ['**/*.css'],
  scripts: {
    build: 'tsup src/index.ts --format esm,cjs --dts --external react --external react-dom --clean',
    dev: 'tsup src/index.ts --format esm,cjs --dts --external react --external react-dom --watch',
    lint: 'eslint .',
    typecheck: 'tsc -p tsconfig.json --noEmit',
    test: 'jest',
    clean: 'rimraf dist coverage .turbo',
  },
  peerDependencies: {
    react: '^19.0.0',
    'react-dom': '^19.0.0',
  },
  devDependencies: {
    '@auvora/config': 'workspace:*',
    '@types/jest': '^29.5.14',
    '@types/react': '^19.0.10',
    '@types/react-dom': '^19.0.4',
    eslint: '^9.22.0',
    jest: '^29.7.0',
    'jest-environment-jsdom': '^29.7.0',
    react: '^19.0.0',
    'react-dom': '^19.0.0',
    rimraf: '^6.0.1',
    'ts-jest': '^29.2.6',
    tsup: '^8.4.0',
    typescript: '^5.8.2',
  },
});

write(
  'packages/ui/tsconfig.json',
  `{
  "extends": "@auvora/config/tsconfig/library.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "types": ["jest"]
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts", "**/*.test.tsx"]
}
`,
);

write(
  'packages/ui/eslint.config.mjs',
  `import { nextConfig } from '@auvora/config/eslint/next';

export default [...nextConfig];
`,
);

write(
  'packages/ui/jest.config.cjs',
  `const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/ui',
  rootDir: __dirname,
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
      },
    ],
  },
};
`,
);

write(
  'packages/ui/src/tokens.ts',
  `export const tokens = {
  color: {
    ink: '#0B1220',
    paper: '#F7F4EF',
    accent: '#0F6E56',
    accentMuted: '#D7EDE6',
    danger: '#B42318',
    border: '#D6D3CD',
  },
  font: {
    sans: '"IBM Plex Sans", "Segoe UI", sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
  },
  radius: {
    sm: '6px',
    md: '10px',
  },
  space: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2.5rem',
  },
} as const;

export type Tokens = typeof tokens;
`,
);

write(
  'packages/ui/src/Button.tsx',
  [
    "import type { ButtonHTMLAttributes, ReactElement } from 'react';",
    "import { tokens } from './tokens';",
    '',
    "export type ButtonVariant = 'primary' | 'secondary' | 'ghost';",
    '',
    'export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {',
    '  variant?: ButtonVariant;',
    '}',
    '',
    'const variantStyles: Record<ButtonVariant, React.CSSProperties> = {',
    '  primary: {',
    '    background: tokens.color.accent,',
    "    color: '#FFFFFF',",
    "    border: `1px solid ${tokens.color.accent}`,",
    '  },',
    '  secondary: {',
    '    background: tokens.color.accentMuted,',
    '    color: tokens.color.ink,',
    "    border: `1px solid ${tokens.color.border}`,",
    '  },',
    '  ghost: {',
    "    background: 'transparent',",
    '    color: tokens.color.ink,',
    "    border: `1px solid ${tokens.color.border}`,",
    '  },',
    '};',
    '',
    'export function Button({',
    "  variant = 'primary',",
    '  style,',
    "  type = 'button',",
    '  children,',
    '  ...rest',
    '}: ButtonProps): ReactElement {',
    '  return (',
    '    <button',
    '      type={type}',
    '      style={{',
    '        fontFamily: tokens.font.sans,',
    '        fontWeight: 600,',
    '        borderRadius: tokens.radius.sm,',
    '        padding: `${tokens.space.sm} ${tokens.space.md}`,',
    "        cursor: rest.disabled ? 'not-allowed' : 'pointer',",
    '        opacity: rest.disabled ? 0.6 : 1,',
    '        ...variantStyles[variant],',
    '        ...style,',
    '      }}',
    '      {...rest}',
    '    >',
    '      {children}',
    '    </button>',
    '  );',
    '}',
  ].join('\n'),
);

write(
  'packages/ui/src/Button.test.tsx',
  `import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    const html = renderToStaticMarkup(createElement(Button, null, 'Continue'));
    expect(html).toContain('Continue');
    expect(html).toContain('<button');
  });
});
`,
);

write(
  'packages/ui/src/styles.css',
  `:root {
  --auvora-ink: #0b1220;
  --auvora-paper: #f7f4ef;
  --auvora-accent: #0f6e56;
  --auvora-accent-muted: #d7ede6;
  --auvora-border: #d6d3cd;
  --auvora-font-sans: "IBM Plex Sans", "Segoe UI", sans-serif;
  --auvora-font-mono: "IBM Plex Mono", ui-monospace, monospace;
}

.auvora-surface {
  background: var(--auvora-paper);
  color: var(--auvora-ink);
  font-family: var(--auvora-font-sans);
}
`,
);

write(
  'packages/ui/src/index.ts',
  `export { Button } from './Button';
export type { ButtonProps, ButtonVariant } from './Button';
export { tokens } from './tokens';
export type { Tokens } from './tokens';
`,
);

// ---------------------------------------------------------------------------
// packages/sdk
// ---------------------------------------------------------------------------
writeJson('packages/sdk/package.json', {
  name: '@auvora/sdk',
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
  'packages/sdk/tsconfig.json',
  `{
  "extends": "@auvora/config/tsconfig/library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node", "jest"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
`,
);

write(
  'packages/sdk/eslint.config.mjs',
  `import { baseConfig } from '@auvora/config/eslint/base';

export default [...baseConfig];
`,
);

write(
  'packages/sdk/jest.config.cjs',
  `const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/sdk',
  rootDir: __dirname,
};
`,
);

write(
  'packages/sdk/src/client.ts',
  [
    "import { HealthStatus, type HealthCheckResponse } from '@auvora/types';",
    '',
    'export interface AuvoraClientOptions {',
    '  baseUrl: string;',
    '  fetchImpl?: typeof fetch;',
    '  defaultHeaders?: Record<string, string>;',
    '}',
    '',
    'export class AuvoraClientError extends Error {',
    '  constructor(',
    '    message: string,',
    '    readonly status: number,',
    '    readonly body?: unknown,',
    '  ) {',
    '    super(message);',
    "    this.name = 'AuvoraClientError';",
    '  }',
    '}',
    '',
    'export class AuvoraClient {',
    '  private readonly baseUrl: string;',
    '  private readonly fetchImpl: typeof fetch;',
    '  private readonly defaultHeaders: Record<string, string>;',
    '',
    '  constructor(options: AuvoraClientOptions) {',
    '    this.baseUrl = options.baseUrl.replace(/\\/$/, \'\');',
    '    this.fetchImpl = options.fetchImpl ?? fetch;',
    '    this.defaultHeaders = options.defaultHeaders ?? {};',
    '  }',
    '',
    '  async getHealth(): Promise<HealthCheckResponse> {',
    '    const response = await this.fetchImpl(`${this.baseUrl}/health`, {',
    "      method: 'GET',",
    '      headers: {',
    "        Accept: 'application/json',",
    '        ...this.defaultHeaders,',
    '      },',
    '    });',
    '',
    '    const body: unknown = await response.json().catch(() => undefined);',
    '',
    '    if (!response.ok) {',
    '      throw new AuvoraClientError(',
    '        `Health check failed with status ${response.status}`,',
    '        response.status,',
    '        body,',
    '      );',
    '    }',
    '',
    '    return this.parseHealth(body);',
    '  }',
    '',
    '  private parseHealth(body: unknown): HealthCheckResponse {',
    "    if (!body || typeof body !== 'object') {",
    "      throw new AuvoraClientError('Invalid health response payload', 500, body);",
    '    }',
    '',
    '    const record = body as Record<string, unknown>;',
    "    const status = record['status'];",
    "    const service = record['service'];",
    "    const version = record['version'];",
    "    const timestamp = record['timestamp'];",
    "    const uptimeSeconds = record['uptimeSeconds'];",
    '',
    '    if (',
    "      typeof status !== 'string' ||",
    '      !Object.values(HealthStatus).includes(status as HealthStatus) ||',
    "      typeof service !== 'string' ||",
    "      typeof version !== 'string' ||",
    "      typeof timestamp !== 'string' ||",
    "      typeof uptimeSeconds !== 'number'",
    '    ) {',
    "      throw new AuvoraClientError('Health response failed validation', 500, body);",
    '    }',
    '',
    '    return {',
    '      status: status as HealthStatus,',
    '      service,',
    '      version,',
    '      timestamp,',
    '      uptimeSeconds,',
    '    };',
    '  }',
    '}',
  ].join('\n'),
);

write(
  'packages/sdk/src/client.test.ts',
  `import { HealthStatus } from '@auvora/types';
import { AuvoraClient } from './client';

describe('AuvoraClient', () => {
  it('returns parsed health payloads', async () => {
    const payload = {
      status: HealthStatus.Ok,
      service: 'gateway',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 12,
    };

    const client = new AuvoraClient({
      baseUrl: 'http://localhost:3000',
      fetchImpl: async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    await expect(client.getHealth()).resolves.toEqual(payload);
  });
});
`,
);

write(
  'packages/sdk/src/index.ts',
  `export { AuvoraClient, AuvoraClientError } from './client';
export type { AuvoraClientOptions } from './client';
`,
);

// ---------------------------------------------------------------------------
// packages/database + database/
// ---------------------------------------------------------------------------
writeJson('packages/database/package.json', {
  name: '@auvora/database',
  version: '0.1.0',
  private: true,
  main: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': {
      types: './dist/index.d.ts',
      default: './dist/index.js',
    },
  },
  scripts: {
    build: 'tsc -p tsconfig.json',
    generate: 'prisma generate --schema ../../database/prisma/schema.prisma',
    'migrate:dev': 'prisma migrate dev --schema ../../database/prisma/schema.prisma',
    'migrate:deploy': 'prisma migrate deploy --schema ../../database/prisma/schema.prisma',
    seed: 'tsx ../../database/seed/index.ts',
    lint: 'eslint .',
    typecheck: 'tsc -p tsconfig.json --noEmit',
    test: 'jest --passWithNoTests',
    clean: 'rimraf dist coverage .turbo',
  },
  dependencies: {
    '@nestjs/common': '^11.0.12',
    '@prisma/client': '^6.5.0',
  },
  devDependencies: {
    '@auvora/config': 'workspace:*',
    '@types/jest': '^29.5.14',
    '@types/node': '^22.13.10',
    eslint: '^9.22.0',
    jest: '^29.7.0',
    prisma: '^6.5.0',
    rimraf: '^6.0.1',
    'ts-jest': '^29.2.6',
    tsx: '^4.19.3',
    typescript: '^5.8.2',
  },
});

write(
  'packages/database/tsconfig.json',
  `{
  "extends": "@auvora/config/tsconfig/nest.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "**/*.spec.ts", "**/*.test.ts"]
}
`,
);

write(
  'packages/database/eslint.config.mjs',
  `import { nestConfig } from '@auvora/config/eslint/nest';

export default [...nestConfig];
`,
);

write(
  'packages/database/jest.config.cjs',
  `const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/database',
  rootDir: __dirname,
};
`,
);

write(
  'packages/database/src/prisma.service.ts',
  [
    "import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';",
    "import { PrismaClient } from '@prisma/client';",
    '',
    '@Injectable()',
    'export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {',
    '  async onModuleInit(): Promise<void> {',
    '    await this.$connect();',
    '  }',
    '',
    '  async onModuleDestroy(): Promise<void> {',
    '    await this.$disconnect();',
    '  }',
    '',
    '  async isHealthy(): Promise<boolean> {',
    '    try {',
    '      await this.$queryRaw`SELECT 1`;',
    '      return true;',
    '    } catch {',
    '      return false;',
    '    }',
    '  }',
    '}',
  ].join('\n'),
);

write(
  'packages/database/src/prisma.module.ts',
  `import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
`,
);

write(
  'packages/database/src/index.ts',
  `export { PrismaModule } from './prisma.module';
export { PrismaService } from './prisma.service';
export { PrismaClient } from '@prisma/client';
`,
);

write(
  'database/prisma/schema.prisma',
  `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// Infrastructure metadata row used to validate migrations without product models.
model SchemaMeta {
  id        String   @id @default("auvora")
  version   String
  appliedAt DateTime @default(now()) @map("applied_at")

  @@map("schema_meta")
}
`,
);

write(
  'database/prisma/migrations/migration_lock.toml',
  `# Please do not edit this file manually
# It should be added in your version-control system (i.e. Git)
provider = "postgresql"
`,
);

write(
  'database/prisma/migrations/20260725120000_init_schema_meta/migration.sql',
  `-- CreateTable
CREATE TABLE "schema_meta" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_meta_pkey" PRIMARY KEY ("id")
);
`,
);

write(
  'database/seed/index.ts',
  [
    "import { PrismaClient } from '@prisma/client';",
    '',
    'const prisma = new PrismaClient();',
    '',
    'async function main(): Promise<void> {',
    '  await prisma.schemaMeta.upsert({',
    "    where: { id: 'auvora' },",
    '    create: {',
    "      id: 'auvora',",
    "      version: '0.1.0',",
    '    },',
    '    update: {',
    "      version: '0.1.0',",
    '    },',
    '  });',
    '',
    '  process.stdout.write(',
    '    JSON.stringify({',
    "      level: 'info',",
    "      msg: 'database seed completed',",
    "      service: 'database-seed',",
    "      version: '0.1.0',",
    "    }) + '\\n',",
    '  );',
    '}',
    '',
    'main()',
    '  .catch((error: unknown) => {',
    '    const message = error instanceof Error ? error.message : String(error);',
    '    process.stderr.write(',
    '      JSON.stringify({',
    "        level: 'error',",
    "        msg: 'database seed failed',",
    '        error: message,',
    "      }) + '\\n',",
    '    );',
    '    process.exitCode = 1;',
    '  })',
    '  .finally(async () => {',
    '    await prisma.$disconnect();',
    '  });',
  ].join('\n'),
);

writeJson('database/package.json', {
  name: '@auvora/database-root',
  version: '0.1.0',
  private: true,
  scripts: {
    generate: 'pnpm --filter @auvora/database generate',
    'migrate:dev': 'pnpm --filter @auvora/database migrate:dev',
    seed: 'pnpm --filter @auvora/database seed',
  },
});

// ---------------------------------------------------------------------------
// NestJS services
// ---------------------------------------------------------------------------
for (const service of services) {
  const pkgName = `@auvora/${service.name}-service`;
  const dir = `services/${service.name}`;

  writeJson(`${dir}/package.json`, {
    name: pkgName,
    version: '0.1.0',
    private: true,
    scripts: {
      build: 'nest build',
      dev: 'nest start --watch',
      start: 'node dist/main.js',
      'start:prod': 'node dist/main.js',
      lint: 'eslint .',
      typecheck: 'tsc -p tsconfig.json --noEmit',
      test: 'jest',
      'test:e2e': 'jest --config ./test/jest-e2e.json',
      clean: 'rimraf dist coverage .turbo',
    },
    dependencies: {
      '@auvora/database': 'workspace:*',
      '@auvora/security': 'workspace:*',
      '@auvora/types': 'workspace:*',
      '@nestjs/common': '^11.0.12',
      '@nestjs/core': '^11.0.12',
      '@nestjs/platform-express': '^11.0.12',
      '@nestjs/swagger': '^11.0.6',
      '@nestjs/terminus': '^11.0.0',
      '@opentelemetry/api': '^1.9.0',
      '@opentelemetry/sdk-node': '^0.57.2',
      '@opentelemetry/auto-instrumentations-node': '^0.56.1',
      '@opentelemetry/exporter-trace-otlp-http': '^0.57.2',
      'nestjs-pino': '^4.3.0',
      pino: '^9.6.0',
      'pino-http': '^10.4.0',
      'reflect-metadata': '^0.2.2',
      rxjs: '^7.8.2',
      zod: '^3.24.2',
    },
    devDependencies: {
      '@auvora/config': 'workspace:*',
      '@nestjs/cli': '^11.0.5',
      '@nestjs/schematics': '^11.0.2',
      '@nestjs/testing': '^11.0.12',
      '@types/express': '^5.0.0',
      '@types/jest': '^29.5.14',
      '@types/node': '^22.13.10',
      '@types/supertest': '^6.0.2',
      eslint: '^9.22.0',
      jest: '^29.7.0',
      'pino-pretty': '^13.0.0',
      rimraf: '^6.0.1',
      supertest: '^7.0.0',
      'ts-jest': '^29.2.6',
      'ts-node': '^10.9.2',
      typescript: '^5.8.2',
    },
  });

  write(
    `${dir}/tsconfig.json`,
    `{
  "extends": "@auvora/config/tsconfig/nest.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": "."
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
`,
  );

  write(
    `${dir}/tsconfig.build.json`,
    `{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
`,
  );

  writeJson(`${dir}/nest-cli.json`, {
    $schema: 'https://json.schemastore.org/nest-cli',
    collection: '@nestjs/schematics',
    sourceRoot: 'src',
    compilerOptions: {
      deleteOutDir: true,
      tsConfigPath: 'tsconfig.build.json',
    },
  });

  write(
    `${dir}/eslint.config.mjs`,
    `import { nestConfig } from '@auvora/config/eslint/nest';

export default [...nestConfig];
`,
  );

  write(
    `${dir}/jest.config.cjs`,
    `const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '${pkgName}',
  rootDir: __dirname,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
`,
  );

  writeJson(`${dir}/test/jest-e2e.json`, {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: '.e2e-spec.ts$',
    transform: {
      '^.+\\.(t|j)s$': 'ts-jest',
    },
  });

  write(
    `${dir}/src/config/env.schema.ts`,
    [
      "import { z } from 'zod';",
      '',
      'export const envSchema = z.object({',
      "  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),",
      `  PORT: z.coerce.number().int().positive().default(${service.port}),`,
      `  SERVICE_NAME: z.string().default('${service.name}'),`,
      "  SERVICE_VERSION: z.string().default('0.1.0'),",
      "  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),",
      '  DATABASE_URL: z.string().url().optional(),',
      '  REDIS_URL: z.string().url().optional(),',
      '  OTEL_ENABLED: z',
      "    .enum(['true', 'false'])",
      "    .default('false')",
      "    .transform((value) => value === 'true'),",
      "  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),",
      '});',
      '',
      'export type ServiceEnv = z.infer<typeof envSchema>;',
      '',
      'export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServiceEnv {',
      '  const parsed = envSchema.safeParse(source);',
      '  if (!parsed.success) {',
      '    const details = parsed.error.issues',
      "      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)",
      "      .join('; ');",
      '    throw new Error(`Invalid environment configuration: ${details}`);',
      '  }',
      '  return parsed.data;',
      '}',
    ].join('\n'),
  );

  write(
    `${dir}/src/infrastructure/observability/otel.ts`,
    [
      "import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';",
      "import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';",
      "import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';",
      "import { NodeSDK } from '@opentelemetry/sdk-node';",
      "import type { ServiceEnv } from '../../config/env.schema';",
      '',
      'let sdk: NodeSDK | undefined;',
      '',
      'export async function startOpenTelemetry(env: ServiceEnv): Promise<void> {',
      '  if (!env.OTEL_ENABLED || sdk) {',
      '    return;',
      '  }',
      '',
      '  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);',
      '',
      '  sdk = new NodeSDK({',
      '    serviceName: env.SERVICE_NAME,',
      '    traceExporter: new OTLPTraceExporter({',
      "      url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\\/$/, '')}/v1/traces`,",
      '    }),',
      '    instrumentations: [getNodeAutoInstrumentations()],',
      '  });',
      '',
      '  await sdk.start();',
      '}',
      '',
      'export async function shutdownOpenTelemetry(): Promise<void> {',
      '  if (!sdk) {',
      '    return;',
      '  }',
      '  await sdk.shutdown();',
      '  sdk = undefined;',
      '}',
    ].join('\n'),
  );

  write(
    `${dir}/src/infrastructure/logging/logger.module.ts`,
    `import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { loadEnv } from '../../config/env.schema';

const env = loadEnv();

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        transport:
          env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                },
              }
            : undefined,
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          remove: true,
        },
      },
    }),
  ],
})
export class LoggerInfrastructureModule {}
`,
  );

  write(
    `${dir}/src/infrastructure/redis/redis.port.ts`,
    `export const REDIS_PORT = Symbol('REDIS_PORT');

export interface RedisPort {
  ping(): Promise<boolean>;
}
`,
  );

  write(
    `${dir}/src/infrastructure/redis/noop-redis.adapter.ts`,
    `import { Injectable } from '@nestjs/common';
import type { RedisPort } from './redis.port';

@Injectable()
export class NoopRedisAdapter implements RedisPort {
  async ping(): Promise<boolean> {
    return false;
  }
}
`,
  );

  write(
    `${dir}/src/domain/index.ts`,
    `/**
 * Domain layer for the ${service.name} bounded context.
 * Product entities and value objects are introduced in later phases.
 */
export {};
`,
  );

  write(
    `${dir}/src/application/application.module.ts`,
    `import { Module } from '@nestjs/common';

@Module({})
export class ApplicationModule {}
`,
  );

  write(
    `${dir}/src/presentation/http/health.controller.ts`,
    `import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthStatus, type HealthCheckResponse } from '@auvora/types';
import { loadEnv } from '../../config/env.schema';

@ApiTags('health')
@Controller()
export class HealthController {
  private readonly startedAt = Date.now();
  private readonly env = loadEnv();

  @Get('health')
  @ApiOkResponse({ description: 'Liveness probe' })
  getHealth(): HealthCheckResponse {
    return {
      status: HealthStatus.Ok,
      service: this.env.SERVICE_NAME,
      version: this.env.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  @Get('ready')
  @ApiOkResponse({ description: 'Readiness probe' })
  getReady(): HealthCheckResponse {
    return {
      status: HealthStatus.Ok,
      service: this.env.SERVICE_NAME,
      version: this.env.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks: {
        process: HealthStatus.Ok,
      },
    };
  }
}
`,
  );

  write(
    `${dir}/src/presentation/http/health.controller.spec.ts`,
    `import { HealthStatus } from '@auvora/types';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok liveness payload', () => {
    const controller = new HealthController();
    const result = controller.getHealth();
    expect(result.status).toBe(HealthStatus.Ok);
    expect(result.service).toBe('${service.name}');
    expect(typeof result.uptimeSeconds).toBe('number');
  });
});
`,
  );

  write(
    `${dir}/src/presentation/presentation.module.ts`,
    `import { Module } from '@nestjs/common';
import { HealthController } from './http/health.controller';

@Module({
  controllers: [HealthController],
})
export class PresentationModule {}
`,
  );

  write(
    `${dir}/src/infrastructure/infrastructure.module.ts`,
    `import { Module } from '@nestjs/common';
import { LoggerInfrastructureModule } from './logging/logger.module';
import { NoopRedisAdapter } from './redis/noop-redis.adapter';
import { REDIS_PORT } from './redis/redis.port';

@Module({
  imports: [LoggerInfrastructureModule],
  providers: [
    {
      provide: REDIS_PORT,
      useClass: NoopRedisAdapter,
    },
  ],
  exports: [REDIS_PORT, LoggerInfrastructureModule],
})
export class InfrastructureModule {}
`,
  );

  write(
    `${dir}/src/app.module.ts`,
    `import { Module } from '@nestjs/common';
import { ApplicationModule } from './application/application.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PresentationModule } from './presentation/presentation.module';

@Module({
  imports: [InfrastructureModule, ApplicationModule, PresentationModule],
})
export class AppModule {}
`,
  );

  const swaggerBlock = service.swagger
    ? `
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Auvora Gateway')
    .setDescription('Auvora Wallet API gateway — foundation health surface')
    .setVersion(env.SERVICE_VERSION)
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
`
    : '';

  const swaggerImport = service.swagger
    ? "import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';\n"
    : '';

  write(
    `${dir}/src/main.ts`,
    [
      "import 'reflect-metadata';",
      "import { NestFactory } from '@nestjs/core';",
      "import { Logger } from 'nestjs-pino';",
      swaggerImport.trim(),
      "import { AppModule } from './app.module';",
      "import { loadEnv } from './config/env.schema';",
      "import { shutdownOpenTelemetry, startOpenTelemetry } from './infrastructure/observability/otel';",
      '',
      'async function bootstrap(): Promise<void> {',
      '  const env = loadEnv();',
      '  await startOpenTelemetry(env);',
      '',
      '  const app = await NestFactory.create(AppModule, {',
      '    bufferLogs: true,',
      '  });',
      '',
      '  app.useLogger(app.get(Logger));',
      '  app.enableShutdownHooks();',
      swaggerBlock.trimEnd(),
      '  await app.listen(env.PORT);',
      '',
      '  const logger = app.get(Logger);',
      "  logger.log(`${env.SERVICE_NAME} listening on port ${env.PORT}`, 'Bootstrap');",
      '',
      '  const shutdown = async (signal: string): Promise<void> => {',
      "    logger.log(`Received ${signal}, shutting down`, 'Bootstrap');",
      '    await app.close();',
      '    await shutdownOpenTelemetry();',
      '    process.exit(0);',
      '  };',
      '',
      "  process.on('SIGINT', () => {",
      "    void shutdown('SIGINT');",
      '  });',
      "  process.on('SIGTERM', () => {",
      "    void shutdown('SIGTERM');",
      '  });',
      '}',
      '',
      'bootstrap().catch((error: unknown) => {',
      '  const message = error instanceof Error ? error.stack ?? error.message : String(error);',
      '  console.error(message);',
      '  process.exit(1);',
      '});',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  write(
    `${dir}/test/health.e2e-spec.ts`,
    `import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('${service.name} health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['SERVICE_NAME'] = '${service.name}';
    process.env['PORT'] = '${service.port}';
    process.env['OTEL_ENABLED'] = 'false';
    process.env['NODE_ENV'] = 'test';
    process.env['LOG_LEVEL'] = 'silent';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: '${service.name}',
    });
  });
});
`,
  );
}

// ---------------------------------------------------------------------------
// Next.js apps
// ---------------------------------------------------------------------------
for (const appDef of apps) {
  const dir = `apps/${appDef.name}`;

  writeJson(`${dir}/package.json`, {
    name: `@auvora/${appDef.name}`,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: `next dev --port ${appDef.port}`,
      build: 'next build',
      start: `next start --port ${appDef.port}`,
      lint: 'eslint .',
      typecheck: 'tsc -p tsconfig.json --noEmit',
      test: 'jest --passWithNoTests',
      clean: 'rimraf .next coverage .turbo',
    },
    dependencies: {
      '@auvora/sdk': 'workspace:*',
      '@auvora/types': 'workspace:*',
      '@auvora/ui': 'workspace:*',
      next: '^15.2.2',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      zod: '^3.24.2',
    },
    devDependencies: {
      '@auvora/config': 'workspace:*',
      '@types/jest': '^29.5.14',
      '@types/node': '^22.13.10',
      '@types/react': '^19.0.10',
      '@types/react-dom': '^19.0.4',
      eslint: '^9.22.0',
      jest: '^29.7.0',
      rimraf: '^6.0.1',
      'ts-jest': '^29.2.6',
      typescript: '^5.8.2',
    },
  });

  write(
    `${dir}/tsconfig.json`,
    `{
  "extends": "@auvora/config/tsconfig/next.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "strict": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
  );

  write(
    `${dir}/next.config.ts`,
    `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@auvora/ui', '@auvora/sdk', '@auvora/types'],
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
`,
  );

  write(
    `${dir}/next-env.d.ts`,
    `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited — see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`,
  );

  write(
    `${dir}/eslint.config.mjs`,
    `import { nextConfig } from '@auvora/config/eslint/next';

export default [...nextConfig];
`,
  );

  write(
    `${dir}/jest.config.cjs`,
    `const base = require('@auvora/config/jest/node');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: '@auvora/${appDef.name}',
  rootDir: __dirname,
  testEnvironment: 'node',
};
`,
  );

  write(
    `${dir}/src/env.ts`,
    `import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('${appDef.title}'),
});

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
  NEXT_PUBLIC_APP_NAME: process.env['NEXT_PUBLIC_APP_NAME'] ?? '${appDef.title}',
});
`,
  );

  write(
    `${dir}/src/app/layout.tsx`,
    `import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { env } from '../env';
import '@auvora/ui/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: env.NEXT_PUBLIC_APP_NAME,
  description: 'Auvora Wallet platform',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="en">
      <body className="auvora-surface">{children}</body>
    </html>
  );
}
`,
  );

  write(
    `${dir}/src/app/globals.css`,
    `html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  background:
    radial-gradient(circle at top left, rgba(15, 110, 86, 0.12), transparent 40%),
    linear-gradient(180deg, #f7f4ef 0%, #ebe6de 100%);
  color: var(--auvora-ink);
}

main {
  max-width: 960px;
  margin: 0 auto;
  padding: 4rem 1.5rem;
}

h1 {
  font-size: clamp(2.5rem, 6vw, 4rem);
  letter-spacing: -0.04em;
  margin: 0 0 0.75rem;
}

p {
  max-width: 42rem;
  line-height: 1.6;
  font-size: 1.125rem;
}
`,
  );

  write(
    `${dir}/src/app/page.tsx`,
    `import { Button } from '@auvora/ui';
import type { ReactElement } from 'react';
import { env } from '../env';

export default function HomePage(): ReactElement {
  return (
    <main>
      <h1>{env.NEXT_PUBLIC_APP_NAME}</h1>
      <p>
        Engineering foundation for the Auvora Wallet platform. Product surfaces will land in later
        phases.
      </p>
      <p style={{ marginTop: '1.5rem' }}>
        <Button>Platform ready</Button>
      </p>
    </main>
  );
}
`,
  );

  write(
    `${dir}/src/app/api/health/route.ts`,
    `import { HealthStatus } from '@auvora/types';
import { NextResponse } from 'next/server';

export function GET(): NextResponse {
  return NextResponse.json({
    status: HealthStatus.Ok,
    service: '${appDef.name}',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
}
`,
  );
}

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------
write(
  'docker-compose.yml',
  `services:
  postgres:
    image: postgres:16-alpine
    container_name: auvora-postgres
    restart: unless-stopped
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: auvora
      POSTGRES_PASSWORD: auvora
      POSTGRES_DB: auvora_wallet
    volumes:
      - auvora-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U auvora -d auvora_wallet']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: auvora-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    command: ['redis-server', '--save', '60', '1', '--loglevel', 'warning']
    volumes:
      - auvora-redis-data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  auvora-postgres-data:
  auvora-redis-data:
`,
);

write(
  'infrastructure/docker/Dockerfile.service',
  `# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY services/gateway/package.json ./services/gateway/
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG SERVICE=gateway
COPY services/\${SERVICE} ./services/\${SERVICE}
RUN pnpm turbo run build --filter=@auvora/\${SERVICE}-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG SERVICE=gateway
RUN addgroup -S auvora && adduser -S auvora -G auvora
COPY --from=build /app/services/\${SERVICE}/dist ./dist
COPY --from=build /app/services/\${SERVICE}/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
USER auvora
EXPOSE 3000
CMD ["node", "dist/main.js"]
`,
);

write(
  'infrastructure/docker/Dockerfile.next',
  `# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
ARG APP=web
COPY apps/\${APP}/package.json ./apps/\${APP}/
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG APP=web
COPY apps/\${APP} ./apps/\${APP}
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@auvora/\${APP}

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG APP=web
ARG PORT=3100
RUN addgroup -S auvora && adduser -S auvora -G auvora
COPY --from=build /app/apps/\${APP}/.next/standalone ./
COPY --from=build /app/apps/\${APP}/.next/static ./apps/\${APP}/.next/static
COPY --from=build /app/apps/\${APP}/public ./apps/\${APP}/public
USER auvora
EXPOSE \${PORT}
CMD ["node", "apps/\${APP}/server.js"]
`,
);

write(
  'infrastructure/k8s/base/namespace.yaml',
  `apiVersion: v1
kind: Namespace
metadata:
  name: auvora-wallet
  labels:
    app.kubernetes.io/name: auvora-wallet
    app.kubernetes.io/part-of: auvora
`,
);

write(
  'infrastructure/k8s/base/gateway-deployment.yaml',
  `apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway
  namespace: auvora-wallet
  labels:
    app.kubernetes.io/name: gateway
    app.kubernetes.io/component: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: gateway
  template:
    metadata:
      labels:
        app.kubernetes.io/name: gateway
    spec:
      containers:
        - name: gateway
          image: auvora/gateway-service:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: NODE_ENV
              value: production
            - name: PORT
              value: '3000'
            - name: SERVICE_NAME
              value: gateway
            - name: OTEL_ENABLED
              value: 'false'
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 15
            timeoutSeconds: 3
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
`,
);

write(
  'infrastructure/k8s/base/gateway-service.yaml',
  `apiVersion: v1
kind: Service
metadata:
  name: gateway
  namespace: auvora-wallet
  labels:
    app.kubernetes.io/name: gateway
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: gateway
  ports:
    - name: http
      port: 80
      targetPort: 3000
      protocol: TCP
`,
);

write(
  'infrastructure/terraform/providers.tf',
  `terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "auvora-wallet"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
`,
);

write(
  'infrastructure/terraform/variables.tf',
  `variable "aws_region" {
  description = "AWS region for Auvora Wallet infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "development"
}

variable "project_name" {
  description = "Canonical project identifier"
  type        = string
  default     = "auvora-wallet"
}

variable "vpc_cidr" {
  description = "CIDR block for the platform VPC"
  type        = string
  default     = "10.20.0.0/16"
}
`,
);

write(
  'infrastructure/terraform/main.tf',
  `data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "\${var.project_name}-\${var.environment}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "\${var.project_name}-\${var.environment}-igw"
  }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "\${var.project_name}-\${var.environment}-public-\${count.index + 1}"
  }
}
`,
);

write(
  'infrastructure/terraform/outputs.tf',
  `output "vpc_id" {
  description = "ID of the Auvora Wallet VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs for edge-facing workloads"
  value       = aws_subnet.public[*].id
}

output "internet_gateway_id" {
  description = "Internet gateway attached to the VPC"
  value       = aws_internet_gateway.main.id
}
`,
);

write(
  'infrastructure/monitoring/otel-collector-config.yaml',
  `receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 512
  memory_limiter:
    check_interval: 1s
    limit_mib: 256

exporters:
  logging:
    verbosity: basic
  otlphttp:
    endpoint: http://localhost:4318

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [logging]
`,
);

write(
  'infrastructure/monitoring/docker-compose.monitoring.yml',
  `services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.119.0
    container_name: auvora-otel-collector
    restart: unless-stopped
    command: ['--config=/etc/otel-collector-config.yaml']
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml:ro
    ports:
      - '4317:4317'
      - '4318:4318'
    healthcheck:
      test: ['CMD', '/otelcol-contrib', 'components']
      interval: 30s
      timeout: 10s
      retries: 3
`,
);

// ---------------------------------------------------------------------------
// Quality, docs, and helper scripts
// ---------------------------------------------------------------------------
write(
  '.github/workflows/ci.yml',
  `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Lint, typecheck, test, build
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.15.9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
`,
);

write(
  '.husky/pre-commit',
  `pnpm exec lint-staged
`,
);

write(
  '.husky/commit-msg',
  `pnpm exec commitlint --edit "$1"
`,
);

writeJson('typedoc.json', {
  $schema: 'https://typedoc.org/schema.json',
  entryPoints: [
    'packages/types/src/index.ts',
    'packages/ui/src/index.ts',
    'packages/sdk/src/index.ts',
    'packages/security/src/index.ts',
    'packages/database/src/index.ts',
  ],
  out: 'docs/api',
  tsconfig: 'tsconfig.base.json',
  excludePrivate: true,
  excludeInternal: true,
  readme: 'README.md',
  name: 'Auvora Wallet API',
});

write(
  'README.md',
  [
    '# Auvora Wallet',
    '',
    'Enterprise cryptocurrency wallet platform monorepo. This repository contains the engineering foundation: shared packages, NestJS microservices, Next.js apps, database schema, and infrastructure stubs.',
    '',
    '## Architecture',
    '',
    '- **packages/** — Shared libraries (`@auvora/types`, `@auvora/ui`, `@auvora/sdk`, `@auvora/database`, `@auvora/security`, `@auvora/config`)',
    '- **services/** — NestJS 11 services with hexagonal layout (domain, application, infrastructure, presentation)',
    '- **apps/** — Next.js 15 App Router frontends (web, admin, docs)',
    '- **database/** — Prisma schema, migrations, and seed scripts',
    '- **infrastructure/** — Docker, Kubernetes, Terraform, and observability configs',
    '',
    'See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.',
    '',
    '## Prerequisites',
    '',
    '- Node.js >= 22 (see `.nvmrc`)',
    '- pnpm >= 9.15',
    '- Docker (optional, for Postgres and Redis)',
    '',
    '## Setup',
    '',
    '```bash',
    'pnpm install',
    'node scripts/bootstrap.mjs',
    'docker compose up -d',
    'pnpm db:generate',
    'pnpm db:migrate',
    'pnpm db:seed',
    '```',
    '',
    'Copy `.env.example` values into `.env` via `scripts/bootstrap.mjs` if you have not already.',
    '',
    '## Scripts',
    '',
    '| Script | Description |',
    '|--------|-------------|',
    '| `pnpm dev` | Start all packages in parallel via Turbo |',
    '| `pnpm build` | Build all packages and apps |',
    '| `pnpm lint` | ESLint across the monorepo |',
    '| `pnpm typecheck` | TypeScript project references check |',
    '| `pnpm test` | Jest unit and integration tests |',
    '| `pnpm db:generate` | Generate Prisma client |',
    '| `pnpm db:migrate` | Run database migrations |',
    '| `pnpm db:seed` | Seed schema metadata |',
    '| `pnpm docs:api` | Generate TypeDoc API reference |',
    '',
    '## Service ports',
    '',
    '| Service | Port |',
    '|---------|------|',
    '| gateway | 3000 |',
    '| auth | 3001 |',
    '| wallet | 3002 |',
    '| blockchain | 3003 |',
    '| payments | 3004 |',
    '| compliance | 3005 |',
    '| notifications | 3006 |',
    '| analytics | 3007 |',
    '| ai | 3008 |',
    '',
    '## App ports',
    '',
    '| App | Port |',
    '|-----|------|',
    '| web | 3100 |',
    '| admin | 3101 |',
    '| docs | 3102 |',
    '',
    '## Contributing',
    '',
    'See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).',
  ].join('\n'),
);

write(
  'docs/ARCHITECTURE.md',
  [
    '# Architecture',
    '',
    'Auvora Wallet is organized as a **modular monolith in development** with independently deployable services. Each bounded context owns its domain logic while sharing platform packages.',
    '',
    '## Layers (hexagonal)',
    '',
    'Every NestJS service follows the same folder structure:',
    '',
    '```',
    'services/<name>/src/',
    '  domain/           # Entities, value objects, domain services',
    '  application/      # Use cases and orchestration',
    '  infrastructure/   # Adapters (logging, Redis, observability)',
    '  presentation/     # HTTP controllers and DTOs',
    '```',
    '',
    'The foundation phase exposes **health endpoints only** (`/health`, `/ready`). Product APIs are added in later phases.',
    '',
    '## Shared packages',
    '',
    '| Package | Role |',
    '|---------|------|',
    '| `@auvora/types` | Cross-cutting TypeScript types and Result helpers |',
    '| `@auvora/ui` | React design system primitives |',
    '| `@auvora/sdk` | Typed HTTP client for platform APIs |',
    '| `@auvora/database` | Prisma NestJS module |',
    '| `@auvora/security` | Security headers and crypto helpers |',
    '| `@auvora/config` | ESLint, Prettier, Jest, and TS configs |',
    '',
    '## Data',
    '',
    'Prisma manages a single `SchemaMeta` table for migration validation. Product models will extend the schema incrementally.',
    '',
    '## Observability',
    '',
    'Services integrate **Pino** structured logging and optional **OpenTelemetry** tracing via OTLP. A local collector config lives in `infrastructure/monitoring/`.',
    '',
    '## Deployment',
    '',
    '- **Docker Compose** — Local Postgres 16 and Redis 7',
    '- **Kubernetes** — Base manifests for the gateway with liveness/readiness probes',
    '- **Terraform** — AWS VPC stub for future cloud provisioning',
  ].join('\n'),
);

write(
  'docs/CONTRIBUTING.md',
  [
    '# Contributing',
    '',
    'Thank you for contributing to Auvora Wallet.',
    '',
    '## Development workflow',
    '',
    '1. Fork and clone the repository.',
    '2. Run `pnpm install` and `node scripts/bootstrap.mjs`.',
    '3. Start infrastructure: `docker compose up -d`.',
    '4. Generate and migrate the database: `pnpm db:generate && pnpm db:migrate`.',
    '5. Create a feature branch from `develop`.',
    '6. Make changes with tests.',
    '7. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before opening a PR.',
    '',
    '## Commit conventions',
    '',
    'We use [Conventional Commits](https://www.conventionalcommits.org/). Husky runs `lint-staged` on pre-commit and `commitlint` on commit-msg.',
    '',
    'Examples:',
    '',
    '- `feat(wallet): add balance query port`',
    '- `fix(gateway): correct health uptime calculation`',
    '- `chore(deps): bump nestjs to 11.0.12`',
    '',
    '## Code style',
    '',
    '- TypeScript strict mode everywhere',
    '- ESLint + Prettier enforced via lint-staged',
    '- Prefer `@auvora/*` workspace packages over duplicated logic',
    '- No `any` — use proper types or `unknown` with narrowing',
    '',
    '## Pull requests',
    '',
    '- Keep PRs focused and reviewable',
    '- Include a test plan in the PR description',
    '- Ensure CI passes (lint, typecheck, test, build)',
  ].join('\n'),
);

write(
  'docs/adr/0001-modular-monolith.md',
  `# ADR 0001: Modular Monolith with Service Boundaries

- **Status:** Accepted
- **Date:** 2026-07-25
- **Context:** Auvora Wallet needs rapid iteration early on while preserving the option to scale services independently.

## Decision

Organize the codebase as a **pnpm monorepo** with:

1. Shared packages for types, UI, SDK, database, and config
2. Nine NestJS services with explicit hexagonal folders
3. Three Next.js apps for user, admin, and documentation surfaces
4. A single Prisma schema with migration history

Services communicate over HTTP in development and can be deployed independently via Docker/Kubernetes.

## Consequences

**Positive**

- Clear ownership boundaries per service
- Shared tooling and types reduce drift
- Turbo orchestrates builds and tests efficiently

**Negative**

- More boilerplate than a single NestJS app
- Cross-service transactions require explicit design later

## Alternatives considered

- **Single NestJS monolith** — Simpler initially but harder to scale teams and deployments.
- **Full microservices from day one** — Premature without product validation.
`,
);

write(
  'scripts/bootstrap.mjs',
  `/**
 * Copies .env.example to .env when .env is missing.
 * Run: node scripts/bootstrap.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = path.join(root, '.env.example');
const target = path.join(root, '.env');

if (!fs.existsSync(example)) {
  console.error('.env.example not found — cannot bootstrap environment');
  process.exit(1);
}

if (fs.existsSync(target)) {
  console.log('.env already exists — skipping copy');
  process.exit(0);
}

fs.copyFileSync(example, target);
console.log('Created .env from .env.example');
`,
);

write(
  'scripts/generate.mjs',
  `/**
 * Wrapper for Prisma client generation.
 * Run: node scripts/generate.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync('pnpm', ['--filter', '@auvora/database', 'generate'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
`,
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const categories = {
  packages: written.filter((f) => f.startsWith('packages/')).length,
  services: written.filter((f) => f.startsWith('services/')).length,
  apps: written.filter((f) => f.startsWith('apps/')).length,
  database: written.filter((f) => f.startsWith('database/')).length,
  infrastructure: written.filter((f) => f.startsWith('infrastructure/') || f === 'docker-compose.yml')
    .length,
  docs: written.filter((f) => f.startsWith('docs/') || f === 'README.md').length,
  ci: written.filter((f) => f.startsWith('.github/') || f.startsWith('.husky/')).length,
  scripts: written.filter((f) => f.startsWith('scripts/') && f !== 'scripts/generate-foundation.mjs')
    .length,
};

console.log('');
console.log('Auvora Wallet foundation scaffold complete.');
console.log(`Total files written: ${written.length}`);
console.log('');
console.log('Breakdown:');
for (const [category, count] of Object.entries(categories)) {
  console.log(`  ${category}: ${count}`);
}
console.log('');
console.log('Generated:');
for (const file of written.sort()) {
  console.log(`  ${file}`);
}
console.log('');
console.log('Next steps:');
console.log('  pnpm install');
console.log('  node scripts/bootstrap.mjs');
console.log('  docker compose up -d');
console.log('  pnpm db:generate && pnpm db:migrate && pnpm db:seed');

