import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '../../../..');

function adminControllers(): string[] {
  return globSync('services/*/src/presentation/controllers/admin-*.controller.ts', {
    cwd: repoRoot,
    windowsPathsNoEscape: true,
  }).filter((relative) => !relative.replace(/\\/g, '/').endsWith('admin-auth.controller.ts'));
}

describe('Admin route protection contract', () => {
  it('37. every Admin controller requires portal roles (no anonymous /api/v1/admin/*)', () => {
    const controllers = adminControllers();
    expect(controllers.length).toBeGreaterThan(10);
    for (const relative of controllers) {
      const source = readFileSync(join(repoRoot, relative), 'utf8');
      expect(source).toContain('@Roles(...ADMIN_PORTAL_ROLES)');
      expect(source).not.toMatch(/@Public\(\)/);
    }
    const realtime = readFileSync(
      join(repoRoot, 'services/auth/src/presentation/realtime/realtime.controller.ts'),
      'utf8',
    );
    expect(realtime).toContain('@Roles(...ADMIN_PORTAL_ROLES)');
    expect(realtime).not.toMatch(/@Public\(\)/);
  });

  it('high-risk operator mutations require step-up', () => {
    const source = readFileSync(
      join(repoRoot, 'services/auth/src/presentation/controllers/admin-operators.controller.ts'),
      'utf8',
    );
    expect(source).toContain('@RequireStepUp()');
    expect(source.match(/@RequireStepUp\(\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('Admin login JSON does not return access or refresh tokens', () => {
    const source = readFileSync(
      join(repoRoot, 'services/auth/src/presentation/controllers/admin-auth.controller.ts'),
      'utf8',
    );
    expect(source).toContain('publicSessionBody');
    expect(source).toMatch(/csrfToken: tokens\.csrfToken/);
    expect(source).not.toMatch(/accessToken: tokens\.accessToken/);
    expect(source).not.toMatch(/refreshToken: tokens\.refreshToken/);
  });
});
