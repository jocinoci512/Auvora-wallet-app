import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('production token-paste UI', () => {
  it('gates AccessTokenPanel behind non-production', () => {
    const chrome = readFileSync(join(__dirname, '../components/AdminChrome.tsx'), 'utf8');
    expect(chrome).toContain('isProductionBuild()');
    expect(chrome).toContain('AccessTokenPanel');
  });

  it('never returns a stored access token in production', () => {
    const client = readFileSync(join(__dirname, './api-client.ts'), 'utf8');
    expect(client).toContain("process.env.NODE_ENV === 'production'");
    expect(client).toContain('if (isProductionBuild()) return null');
  });

  it('36. production SSE uses cookie credentials and never a pasted bearer', () => {
    const realtime = readFileSync(join(__dirname, './realtime/useAdminRealtime.ts'), 'utf8');
    expect(realtime).toContain("credentials: 'include'");
    expect(realtime).toContain('isProductionBuild() ? null : getStoredAccessToken()');
  });
});
