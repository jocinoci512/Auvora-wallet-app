import {
  assertCredentialedCorsAllowlist,
  createCredentialedCorsOriginDelegate,
  isAllowedCorsOrigin,
  normalizeCorsOriginEntry,
  parseCorsOrigins,
  resolveCredentialedCorsOrigins,
} from './cors-origins';

describe('cors-origins', () => {
  it('parses and normalizes comma-separated origins', () => {
    expect(parseCorsOrigins('https://auvorawallet.com, https://www.auvorawallet.com/path')).toEqual(
      ['https://auvorawallet.com', 'https://www.auvorawallet.com'],
    );
  });

  it('rejects wildcard for credentialed APIs', () => {
    expect(() => assertCredentialedCorsAllowlist(['*'])).toThrow(/wildcard/i);
    expect(() =>
      parseCorsOrigins('*').forEach((o) => assertCredentialedCorsAllowlist([o])),
    ).toThrow(/wildcard/i);
  });

  it('rejects localhost origins in production', () => {
    expect(() =>
      assertCredentialedCorsAllowlist(['http://localhost:3000'], { nodeEnv: 'production' }),
    ).toThrow(/not allowed in production/i);
  });

  it('allows localhost in development', () => {
    expect(
      assertCredentialedCorsAllowlist(['http://localhost:3000', 'http://localhost:3001'], {
        nodeEnv: 'development',
      }),
    ).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('merges APP_PUBLIC_URL into CORS allowlist', () => {
    expect(
      resolveCredentialedCorsOrigins({
        appPublicUrl: 'https://auvorawallet.com',
        corsOriginsCsv: 'https://www.auvorawallet.com',
        nodeEnv: 'production',
      }),
    ).toEqual(['https://auvorawallet.com', 'https://www.auvorawallet.com']);
  });

  it('allow/deny origins without reflecting arbitrary Origin', () => {
    const allowlist = ['https://auvorawallet.com', 'http://localhost:3000'];
    expect(isAllowedCorsOrigin('https://auvorawallet.com', allowlist)).toBe(true);
    expect(isAllowedCorsOrigin('https://evil.example', allowlist)).toBe(false);
    expect(isAllowedCorsOrigin(undefined, allowlist)).toBe(true);

    const delegate = createCredentialedCorsOriginDelegate(allowlist);
    const allowed = jest.fn();
    const denied = jest.fn();
    delegate('https://auvorawallet.com', allowed);
    expect(allowed).toHaveBeenCalledWith(null, true);
    delegate('https://phishing.test', denied);
    expect(denied).toHaveBeenCalledWith(null, false);
  });

  it('normalizes host-only entries to https origins', () => {
    expect(normalizeCorsOriginEntry('auvorawallet.com')).toBe('https://auvorawallet.com');
  });
});
