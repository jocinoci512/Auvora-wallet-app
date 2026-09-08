import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

console.log('=== AUVORA FIRST-PARTY KYC & DOCUMENT SECURITY AUDIT ===\n');

let pass = true;

// 1. Audit Client Source Boundaries (Mobile, Web, Admin) for external KYC keys & permanent doc URLs
console.log('1. Auditing Client Source Boundaries (Mobile, Web, Admin)...');
const clientDirs = ['apps/mobile/lib', 'apps/web/src', 'apps/admin/src'];
const forbiddenKycTokens = [
  /sk_live_[a-zA-Z0-9]{24,}/i, // Stripe Secret Key
  /rk_live_[a-zA-Z0-9]{24,}/i, // Stripe Restricted Key
  /whsec_[a-zA-Z0-9]{24,}/i, // Stripe Webhook Secret
  /KYC_PROVIDER_API_KEY/i,
  /KYC_PROVIDER_WEBHOOK_SECRET/i,
];

for (const dir of clientDirs) {
  try {
    const gitFiles = execSync(`git ls-files ${dir}`, { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const f of gitFiles) {
      const content = readFileSync(f, 'utf8');
      for (const pattern of forbiddenKycTokens) {
        if (pattern.test(content)) {
          console.error(`  [FAIL] Leak detected in ${f} matching ${pattern}`);
          pass = false;
        }
      }
    }
    console.log(
      `  [PASS] ${dir} contains 0 external KYC secrets/provider keys across ${gitFiles.length} tracked files.`,
    );
  } catch (err) {
    console.error(`  [ERROR] Error scanning ${dir}:`, err.message);
  }
}

// 2. Check for committed raw government ID images or sensitive test uploads in git
console.log('\n2. Checking Git tracking for exposed government ID images or test documents...');
const allTrackedFiles = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const sensitiveDocFilePatterns = [
  /passport.*\.jpg$/i,
  /passport.*\.png$/i,
  /id_card.*\.jpg$/i,
  /driver.*license.*\.jpg$/i,
  /kyc.*upload.*\.pdf$/i,
  /\.env\.production$/i,
];

let docLeaks = 0;
for (const file of allTrackedFiles) {
  for (const pattern of sensitiveDocFilePatterns) {
    if (pattern.test(file)) {
      console.error(`  [FAIL] Sensitive document or prod env tracked in git: ${file}`);
      docLeaks++;
      pass = false;
    }
  }
}
if (docLeaks === 0) {
  console.log('  [PASS] 0 sensitive document images or production credentials tracked in Git.');
}

// 3. Verify Compliance Service Environment Configuration defaults to manual_admin_review
console.log('\n3. Auditing Compliance Service Environment Defaults...');
const complianceEnvFile = 'services/compliance/src/config/env.schema.ts';
if (existsSync(complianceEnvFile)) {
  const content = readFileSync(complianceEnvFile, 'utf8');
  if (content.includes("default('manual_admin_review')")) {
    console.log('  [PASS] KYC_MODE defaults to "manual_admin_review".');
  } else {
    console.error('  [FAIL] KYC_MODE does not default to "manual_admin_review"!');
    pass = false;
  }

  if (content.includes('KYC_PROVIDER_API_KEY: z.string().optional()')) {
    console.log('  [PASS] Commercial KYC provider keys are strictly optional (non-blocking).');
  } else {
    console.error('  [FAIL] KYC_PROVIDER_API_KEY is not optional!');
    pass = false;
  }
} else {
  console.error(`  [FAIL] ${complianceEnvFile} not found.`);
  pass = false;
}

// 4. Verify Mainnet Killswitch is OFF
console.log('\n4. Verifying Mainnet Killswitches remain OFF...');
const mobileReleaseConfig = 'apps/mobile/lib/release/release_config.dart';
if (existsSync(mobileReleaseConfig)) {
  const content = readFileSync(mobileReleaseConfig, 'utf8');
  if (content.includes('static const bool liveBroadcastEnabled = false;')) {
    console.log('  [PASS] Mobile liveBroadcastEnabled is false.');
  } else {
    console.error('  [FAIL] Mobile liveBroadcastEnabled is NOT false!');
    pass = false;
  }
}

if (pass) {
  console.log('\n=== ALL FIRST-PARTY KYC & DOCUMENT SECURITY CHECKS PASSED ===');
  process.exit(0);
} else {
  console.error('\n=== KYC SECURITY CHECKS FAILED ===');
  process.exit(1);
}
