import { formatAccountLabel, isGenericDisplayName } from './profile-display';
import type { AuthUser } from './session';

describe('profile-display', () => {
  const base: AuthUser = {
    id: 'u1',
    email: 'emm@example.com',
    username: 'emmilianjoan_96zp',
    displayName: 'Auvora user',
  };

  it('prefers username over generic displayName', () => {
    expect(formatAccountLabel(base)).toBe('emmilianjoan_96zp');
  });

  it('uses real displayName when not generic', () => {
    expect(formatAccountLabel({ ...base, displayName: 'Joan Emm', username: '' })).toBe('Joan Emm');
  });

  it('detects generic placeholder names', () => {
    expect(isGenericDisplayName('Auvora user')).toBe(true);
    expect(isGenericDisplayName('Joan')).toBe(false);
  });
});
