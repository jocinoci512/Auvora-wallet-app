const baseUrl = 'https://gateway-production-bc6a.up.railway.app';

async function testAdmin() {
  console.log('Testing Admin Login against live staging Gateway...');
  const res = await fetch(`${baseUrl}/api/v1/auth/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@auvora.local',
      password: 'ChangeMe!AuvoraAdmin1',
      deviceFingerprint: 'admin-staging-probe',
    }),
  });
  console.log('Admin login status:', res.status, await res.json());
}

testAdmin().catch(console.error);
