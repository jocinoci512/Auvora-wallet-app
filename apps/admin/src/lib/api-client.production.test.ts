import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

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
    expect(realtime).not.toContain('save an admin JWT');
  });

  it('production error copy never asks to paste a JWT', () => {
    const client = readFileSync(join(__dirname, './api-client.ts'), 'utf8');
    expect(client).toContain('formatAdminError');
    expect(client).not.toContain('save an admin JWT');
  });

  it('production Admin pages do not ask operators to paste JWTs', () => {
    const files = walk(join(__dirname, '../app'));
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/save an admin JWT|save a JWT access token/i);
    }
  });
});
