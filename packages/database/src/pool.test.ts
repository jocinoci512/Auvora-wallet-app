import { withDatabaseUrlPool } from './pool';

describe('withDatabaseUrlPool', () => {
  it('appends pool parameters without dropping schema', () => {
    const next = withDatabaseUrlPool(
      'postgresql://auvora:auvora@localhost:5432/auvora_wallet?schema=public',
      { connectionLimit: 20, poolTimeout: 15 },
    );
    const url = new URL(next);
    expect(url.searchParams.get('schema')).toBe('public');
    expect(url.searchParams.get('connection_limit')).toBe('20');
    expect(url.searchParams.get('pool_timeout')).toBe('15');
    expect(url.searchParams.get('connect_timeout')).toBe('5');
  });

  it('does not overwrite existing pool params', () => {
    const next = withDatabaseUrlPool(
      'postgresql://auvora:auvora@localhost:5432/auvora_wallet?connection_limit=3',
      { connectionLimit: 99 },
    );
    expect(new URL(next).searchParams.get('connection_limit')).toBe('3');
  });
});
