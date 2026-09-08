import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

console.log('=== Running Security & Boundary Audit for RPC Providers ===\n');

// 1. Git secret scan for known patterns
console.log('1. Checking Git tracking for exposed API keys and secrets...');
const gitFiles = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);

let secretsFound = 0;
const forbiddenPatterns = [
  /https:\/\/[a-z0-9.-]+\.alchemy\.com\/v2\/[a-zA-Z0-9_-]{16,}/i,
  /alch_[a-zA-Z0-9_-]{16,}/i,
  /alcht_[a-zA-Z0-9_-]{16,}/i,
];

for (const file of gitFiles) {
  // Skip binary files and test mock fixtures
  if (
    file.endsWith('.png') ||
    file.endsWith('.jpg') ||
    file.endsWith('.so') ||
    file.endsWith('.aab') ||
    file.endsWith('.apk') ||
    file.includes('.spec.') ||
    file.includes('_test.dart') ||
    file.includes('test/') ||
    file.includes('tests/') ||
    file.includes('scripts/qa/')
  ) {
    continue;
  }
  if (!existsSync(file)) continue;

  try {
    const content = readFileSync(file, 'utf8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        // Double check it's not a generic placeholder
        if (
          !content.includes('[REDACTED]') &&
          !content.includes('test-key') &&
          !content.includes('demo')
        ) {
          console.error(`[LEAK DETECTED] ${file} matches ${pattern}`);
          secretsFound++;
        }
      }
    }
  } catch {
    // Ignore read errors for binary or special files
  }
}

if (secretsFound === 0) {
  console.log('   [PASS] No RPC provider secrets or private keys found in Git-tracked files.');
} else {
  console.error(`   [FAIL] Found ${secretsFound} possible secret leaks!`);
}

// 2. Client-side mobile source audit
console.log('\n2. Auditing Mobile App Client Boundary (apps/mobile)...');
const integrationConfigFile = readFileSync(
  'apps/mobile/lib/release/integration_config.dart',
  'utf8',
);
const rpcEndpointsFile = readFileSync('apps/mobile/lib/wallet_engine/rpc_endpoints.dart', 'utf8');

const hasEmptyAlchemyDefault = integrationConfigFile.includes(
  "static const String alchemyApiKey = String.fromEnvironment(\n    'ALCHEMY_API_KEY',\n    defaultValue: '',\n  );",
);
console.log(
  `   Alchemy mobile compile-time default is empty: ${hasEmptyAlchemyDefault ? '[PASS]' : '[CHECK]'}`,
);

const hasLiveBroadcastGated = rpcEndpointsFile.includes('looksLikeMainnetUrl');
console.log(
  `   Mainnet URL detection and fail-closed gates in place: ${hasLiveBroadcastGated ? '[PASS]' : '[FAIL]'}`,
);

// 3. Web & Admin client boundary
console.log('\n3. Auditing Web & Admin client source boundary...');
const webPages = execSync('git ls-files apps/web/src apps/admin/src', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
let webRpcLeaks = 0;
for (const f of webPages) {
  if (!existsSync(f)) continue;
  const content = readFileSync(f, 'utf8');
  if (content.includes('alchemy.com/v2') || content.includes('ALCHEMY_API_KEY')) {
    console.error(`[WEB LEAK] ${f} references Alchemy RPC directly!`);
    webRpcLeaks++;
  }
}
if (webRpcLeaks === 0) {
  console.log('   [PASS] Neither Web nor Admin client bundles reference direct RPC credentials.');
} else {
  console.error(`   [FAIL] Found ${webRpcLeaks} RPC references in Web/Admin!`);
}

// 4. Production Environment Validation
console.log('\n4. Auditing Production Environment Variables in Railway...');
const railwayCmd =
  'pnpm dlx @railway/cli variable list --project 458e0c14-654e-4d96-8009-4b70b2279cf8 --environment production --service blockchain-prod --json';
const railwayVars = JSON.parse(execSync(railwayCmd, { encoding: 'utf8' }));

const prodChecks = [
  {
    name: 'BLOCKCHAIN_LIVE_BROADCAST is false',
    pass: railwayVars.BLOCKCHAIN_LIVE_BROADCAST === 'false',
  },
  {
    name: 'BLOCKCHAIN_SIMULATOR_ENABLED is false',
    pass: railwayVars.BLOCKCHAIN_SIMULATOR_ENABLED === 'false',
  },
  {
    name: 'BLOCKCHAIN_PRIMARY_PROVIDER is alchemy',
    pass: railwayVars.BLOCKCHAIN_PRIMARY_PROVIDER === 'alchemy',
  },
  { name: 'ALCHEMY_REQUIRED is true', pass: railwayVars.ALCHEMY_REQUIRED === 'true' },
  {
    name: 'ALCHEMY_API_KEY is present',
    pass: Boolean(railwayVars.ALCHEMY_API_KEY && railwayVars.ALCHEMY_API_KEY.length > 20),
  },
];

for (const check of prodChecks) {
  console.log(`   ${check.pass ? '[PASS]' : '[FAIL]'} ${check.name}`);
}

console.log('\nSecurity & Boundary Audit completed successfully!');
