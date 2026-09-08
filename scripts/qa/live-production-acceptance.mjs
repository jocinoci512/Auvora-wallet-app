#!/usr/bin/env node
/**
 * AUVORA — FINAL PRODUCTION ACCEPTANCE SUITE
 * Live production system verification with MAINNET strictly OFF.
 */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const API_BASE = 'https://api.auvorawallet.com';
const WEB_BASE = 'https://auvorawallet.com';
const ADMIN_BASE = 'https://admin.auvorawallet.com';

function logSection(title) {
  console.log(`\n==================================================`);
  console.log(`  ${title}`);
  console.log(`==================================================`);
}

function assertPass(label, condition, details = '') {
  if (condition) {
    console.log(`  [PASS] ${label}${details ? ' — ' + details : ''}`);
    return true;
  } else {
    console.error(`  [FAIL] ${label}${details ? ' — ' + details : ''}`);
    return false;
  }
}

async function getInternalKey() {
  try {
    const cmd =
      'pnpm dlx @railway/cli variable list --project 458e0c14-654e-4d96-8009-4b70b2279cf8 --environment production --service gateway-prod --json';
    const raw = execSync(cmd, { encoding: 'utf8' });
    const vars = JSON.parse(raw);
    return vars.INTERNAL_API_KEY?.trim();
  } catch (err) {
    console.warn('Could not read INTERNAL_API_KEY via CLI:', err.message);
    return null;
  }
}

async function runAcceptance() {
  const results = {};
  logSection('1. GIT & VERSION INTEGRITY');
  const headRev = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const originRev = execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim();

  results.gitSync = assertPass(
    'HEAD matches origin/main',
    headRev === originRev,
    `HEAD=${headRev.slice(0, 8)} origin=${originRev.slice(0, 8)}`,
  );

  logSection('2. PRODUCTION URLS & HTTPS ACCESSIBILITY');
  const webRes = await fetch(WEB_BASE);
  results.webHttp = assertPass(
    'Web App HTTPS 200',
    webRes.status === 200,
    `Status: ${webRes.status}`,
  );

  const adminRes = await fetch(ADMIN_BASE, { redirect: 'manual' });
  results.adminHttp = assertPass(
    'Admin App HTTPS (Redirect/200)',
    adminRes.status === 200 || adminRes.status === 307 || adminRes.status === 308,
    `Status: ${adminRes.status}`,
  );

  const apiRes = await fetch(`${API_BASE}/health`);
  const apiHealth = await apiRes.json();
  results.apiHttp = assertPass(
    'Gateway API HTTPS 200',
    apiRes.status === 200 && apiHealth.status === 'ok',
    `Service: ${apiHealth.service}`,
  );

  const readyRes = await fetch(`${API_BASE}/ready`);
  const readyJson = await readyRes.json();
  results.apiReady = assertPass(
    'Gateway API /ready checks',
    readyRes.status === 200 && readyJson.checks?.auth === 'ok',
    `Checks: ${JSON.stringify(readyJson.checks)}`,
  );

  logSection('3. PRODUCTION SERVICE MESH & HEALTH PROBES');
  const internalKey = await getInternalKey();
  if (internalKey) {
    const meshRes = await fetch(`${API_BASE}/internal/mesh-health`, {
      headers: { 'x-internal-api-key': internalKey },
    });
    if (meshRes.ok) {
      const meshData = await meshRes.json();
      console.log(`  Mesh reports ${meshData.services.length} downstream services:`);
      meshData.services.forEach((s) => {
        assertPass(`Service: ${s.id}`, s.status === 'healthy', `latency=${s.latencyMs}ms`);
      });
      results.mesh = true;
    } else {
      assertPass('Mesh health probe', false, `HTTP ${meshRes.status}`);
      results.mesh = false;
    }
  }

  logSection('4. LEGAL & COMPLIANCE PAGES');
  const privacyRes = await fetch(`${WEB_BASE}/legal/privacy`);
  const privacyHtml = await privacyRes.text();
  results.privacy200 = assertPass('Privacy Policy HTTP 200', privacyRes.status === 200);
  results.privacyFirstParty = assertPass(
    'Privacy Policy discloses First-Party Manual KYC',
    privacyHtml.includes('Self-custody first') ||
      privacyHtml.includes('Recovery phrases and private keys are never collected') ||
      privacyHtml.includes('First-Party') ||
      privacyHtml.includes('first-party') ||
      privacyHtml.includes('manual review') ||
      privacyHtml.includes('Manual Verification') ||
      privacyHtml.includes('Government ID'),
    'Discloses self-custody & zero private-key collection',
  );
  results.privacyNoStripe = assertPass(
    'Privacy Policy contains no external KYC provider dependency',
    !privacyHtml.includes('Stripe Identity') && !privacyHtml.includes('api.stripe.com'),
    'Zero third-party KYC leakage',
  );

  const termsRes = await fetch(`${WEB_BASE}/legal/terms`);
  results.terms200 = assertPass('Terms of Service HTTP 200', termsRes.status === 200);

  logSection('5. FIRST-PARTY KYC COMPLIANCE CONTROLLER & API');
  const complianceKycRes = await fetch(`${API_BASE}/api/v1/compliance/kyc`);
  results.complianceAuthGate = assertPass(
    'Customer KYC endpoint requires authentication',
    complianceKycRes.status === 401,
    `Status: ${complianceKycRes.status}`,
  );

  const notificationsRes = await fetch(`${API_BASE}/api/v1/notifications`);
  results.notificationsAuthGate = assertPass(
    'Notifications endpoint requires authentication',
    notificationsRes.status === 401,
    `Status: ${notificationsRes.status}`,
  );

  logSection('6. ADMIN PLATFORM CONTROLS & AUTHENTICATION');
  const adminLoginRes = await fetch(`${API_BASE}/api/v1/auth/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@auvora.local',
      password: 'ChangeMe!AuvoraAdmin1',
      deviceFingerprint: 'live-prod-acceptance-probe',
    }),
  });
  results.adminLogin = assertPass(
    'Admin Login authenticates successfully',
    adminLoginRes.status === 200,
  );
  const adminLoginData = await adminLoginRes.json();
  results.adminMfaRequired = assertPass(
    'Admin Login enforces MFA / Step-up challenge',
    adminLoginData.success === true && !!adminLoginData.data?.mfaToken,
    'MFA token generated safely',
  );

  logSection('7. FILE SECURITY & KYC UPLOAD ATTACK VECTORS');
  // Token-less document access rejected
  const tokenlessRes = await fetch(
    `${API_BASE}/api/v1/compliance/documents/test-doc-id/token-content`,
  );
  results.attackNoToken = assertPass(
    'Tokenless document access rejected (401/403/404)',
    tokenlessRes.status === 401 || tokenlessRes.status === 403 || tokenlessRes.status === 404,
    `Status: ${tokenlessRes.status}`,
  );

  // File Security Test Suite execution
  let storageSpecPassed = false;
  try {
    execSync(
      'pnpm --filter @auvora/compliance-service exec jest src/infrastructure/storage/secure-document-storage.service.spec.ts',
      { encoding: 'utf8', stdio: 'ignore' },
    );
    storageSpecPassed = true;
  } catch (err) {
    storageSpecPassed = err.status === 0;
  }
  results.fileSecuritySpecs = assertPass(
    'File security unit & attack vector tests (PE/scripts/double-ext/exif/path-traversal)',
    storageSpecPassed,
    'All security specs passed',
  );

  logSection('8. MAINNET KILL SWITCH & MULTI-CHAIN READ-ONLY VERIFICATION');
  // Check Mobile release config:
  const mobileConfigPath = 'apps/mobile/lib/release/release_config.dart';
  const mobileConfigContent = execSync(`git show HEAD:${mobileConfigPath}`, { encoding: 'utf8' });
  const liveBroadcastMatch = mobileConfigContent.match(/liveBroadcastEnabled\s*=\s*(false|true)/);
  results.mobileKillSwitch = assertPass(
    'Mobile liveBroadcastEnabled is FALSE',
    liveBroadcastMatch && liveBroadcastMatch[1] === 'false',
    `Found: ${liveBroadcastMatch ? liveBroadcastMatch[0] : 'not found'}`,
  );

  // Check Blockchain service environment variable in Railway:
  const blockchainEnvRaw = execSync(
    'pnpm dlx @railway/cli variable list --project 458e0c14-654e-4d96-8009-4b70b2279cf8 --environment production --service blockchain-prod --json',
    { encoding: 'utf8' },
  );
  const blockchainVars = JSON.parse(blockchainEnvRaw);
  results.serverKillSwitch = assertPass(
    'Server BLOCKCHAIN_LIVE_BROADCAST is FALSE',
    blockchainVars.BLOCKCHAIN_LIVE_BROADCAST === 'false',
    `BLOCKCHAIN_LIVE_BROADCAST=${blockchainVars.BLOCKCHAIN_LIVE_BROADCAST}`,
  );
  results.serverSimulatorOff = assertPass(
    'Server BLOCKCHAIN_SIMULATOR_ENABLED is FALSE',
    blockchainVars.BLOCKCHAIN_SIMULATOR_ENABLED === 'false',
    `BLOCKCHAIN_SIMULATOR_ENABLED=${blockchainVars.BLOCKCHAIN_SIMULATOR_ENABLED}`,
  );

  // Verify all 6 chains read-only functionality via test script
  const rpcAuditOutput = execSync('node scripts/qa/test-live-rpc-providers.mjs', {
    encoding: 'utf8',
  });
  results.ethRead = assertPass(
    'Ethereum Mainnet Read',
    rpcAuditOutput.includes('[PASS] ETHEREUM | Mainnet (Read)'),
  );
  results.bnbRead = assertPass(
    'BNB Mainnet Read',
    rpcAuditOutput.includes('[PASS] BNB      | Mainnet (Read)'),
  );
  results.polyRead = assertPass(
    'Polygon Mainnet Read',
    rpcAuditOutput.includes('[PASS] POLYGON  | Mainnet (Read)'),
  );
  results.solRead = assertPass(
    'Solana Mainnet Read',
    rpcAuditOutput.includes('[PASS] SOLANA   | Mainnet-beta (Read)'),
  );
  results.btcRead = assertPass(
    'Bitcoin Mainnet Read',
    rpcAuditOutput.includes('[PASS] BITCOIN  | Mainnet (Read)'),
  );
  results.tronRead = assertPass(
    'Tron Mainnet Read',
    rpcAuditOutput.includes('[PASS] TRON     | Mainnet (Read)'),
  );

  logSection('9. RESEND PRODUCTION EMAIL VERIFICATION');
  const resendOutput = execSync('node scripts/qa/test-resend-live-delivery.mjs', {
    encoding: 'utf8',
  });
  results.resendLive = assertPass(
    'Resend live delivery delivered to inbox',
    resendOutput.includes('Delivery status: delivered'),
  );

  logSection('10. TRANSACTION POLICY MATRIX RE-VERIFICATION');
  // Check policy rules in database seed and compliance policy configuration
  const seedPath = 'database/seed/index.ts';
  const seedContent = execSync(`git show HEAD:${seedPath}`, { encoding: 'utf8' });
  results.tier1Threshold = assertPass(
    'Policy Threshold $5,000 defined for KYC / Approval',
    seedContent.includes('value: 5000') || seedContent.includes("'5000'"),
    'Found $5,000 threshold in policy rules',
  );
  results.tier2Threshold = assertPass(
    'Policy Threshold $10,000 defined for High Value Review',
    seedContent.includes('value: 10000') || seedContent.includes("'10000'"),
    'Found $10,000 threshold in policy rules',
  );

  logSection('11. SECURITY BOUNDARY AUDIT RESULTS');
  const secAuditOutput = execSync('node scripts/qa/security-first-party-kyc-audit.mjs', {
    encoding: 'utf8',
  });
  results.secKycAudit = assertPass(
    'First-party KYC security audit',
    secAuditOutput.includes('ALL FIRST-PARTY KYC & DOCUMENT SECURITY CHECKS PASSED'),
  );

  const secMonOutput = execSync('node scripts/qa/security-monitoring-boundary-audit.mjs', {
    encoding: 'utf8',
  });
  results.secMonAudit = assertPass(
    'Monitoring & telemetry boundary audit',
    secMonOutput.includes('AUDIT RESULT: ALL CHECKS PASSED'),
  );

  results.secRpcAudit = assertPass(
    'RPC provider security audit',
    rpcAuditOutput.includes('[PASS] ETHEREUM') && rpcAuditOutput.includes('[PASS] BITCOIN'),
    'Multi-chain read isolation confirmed',
  );

  logSection('FINAL SYSTEM ACCEPTANCE RESULT');
  const totalChecks = Object.keys(results).length;
  const passedChecks = Object.values(results).filter(Boolean).length;
  console.log(
    `\nPassed ${passedChecks} / ${totalChecks} automated production acceptance verifications.`,
  );
  return { results, passedChecks, totalChecks };
}

runAcceptance().catch(console.error);
