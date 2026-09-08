import { execSync } from 'node:child_process';

function getInternalKey() {
  const cmd =
    'pnpm dlx @railway/cli variable list --project 458e0c14-654e-4d96-8009-4b70b2279cf8 --environment production --service gateway-prod --json';
  const raw = execSync(cmd, { encoding: 'utf8' });
  const vars = JSON.parse(raw);
  return vars.INTERNAL_API_KEY?.trim();
}

const key = getInternalKey();
if (!key) {
  console.error('INTERNAL_API_KEY not found in gateway-prod');
  process.exit(1);
}

async function testMeshHealth() {
  console.log('Querying https://api.auvorawallet.com/internal/mesh-health ...');
  const res = await fetch('https://api.auvorawallet.com/internal/mesh-health', {
    headers: { 'x-internal-api-key': key },
  });
  console.log('Mesh Health HTTP Status:', res.status);
  const data = await res.json();
  console.log('Mesh Health Response:', JSON.stringify(data, null, 2));

  console.log('\nQuerying https://api.auvorawallet.com/metrics/resilience ...');
  const res2 = await fetch('https://api.auvorawallet.com/metrics/resilience', {
    headers: { 'x-internal-api-key': key },
  });
  console.log('Resilience Metrics HTTP Status:', res2.status);
  const data2 = await res2.json();
  console.log('Resilience Metrics Response:', JSON.stringify(data2, null, 2));
}

testMeshHealth().catch(console.error);
