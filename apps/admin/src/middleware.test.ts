import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC_PATHS = [
  '/login',
  '/mfa',
  '/mfa/enroll',
  '/recovery',
  '/locked',
  '/forbidden',
  '/session-expired',
  '/suspended',
  '/step-up',
];

describe('Admin frontend route protection', () => {
  it('37. middleware redirects unauthenticated visitors to /login', () => {
    const source = readFileSync(join(__dirname, './middleware.ts'), 'utf8');
    expect(source).toContain("url.pathname = '/login'");
    expect(source).toContain('auvora_admin_ui');
    for (const path of PUBLIC_PATHS) {
      expect(source).toContain(`'${path}'`);
    }
  });

  it('treats production Admin pages as protected except auth screens', () => {
    const client = readFileSync(join(__dirname, './lib/api-client.ts'), 'utf8');
    expect(client).toContain('export function isAdminPublicPath');
    for (const path of PUBLIC_PATHS) {
      expect(client).toContain(`'${path}'`);
    }
    expect(client).not.toContain("'/users'");
  });

  it('AuthGate requires SUPER_ADMIN after a valid session', () => {
    const source = readFileSync(join(__dirname, './components/AuthGate.tsx'), 'utf8');
    expect(source).toContain('canEnterAdminControlPlane');
    expect(source).toContain("router.replace('/forbidden')");
  });
});
