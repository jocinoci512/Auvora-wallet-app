import { searchAssist, shouldShowEducationalHints, getIntelligencePrefs } from './guidance';

describe('Auvora Intelligence guidance', () => {
  it('search assist finds fees and security', () => {
    expect(searchAssist('fee').some((h) => h.href === '/learn')).toBe(true);
    expect(searchAssist('security').some((h) => h.href === '/security')).toBe(true);
  });

  it('defaults keep external AI off', () => {
    const prefs = getIntelligencePrefs();
    expect(prefs.allowExternalAi).toBe(false);
    expect(shouldShowEducationalHints({ ...prefs, guidanceLevel: 'minimal' })).toBe(false);
    expect(shouldShowEducationalHints({ ...prefs, guidanceLevel: 'balanced' })).toBe(true);
  });
});
