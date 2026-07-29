import { parseTraits, sanitizeText, sanitizeUrl } from './metadata-sanitizer';

describe('metadata sanitizer', () => {
  it('strips control chars and truncates', () => {
    expect(sanitizeText('hi\u0000there', 5)).toBe('hithe');
  });

  it('rejects unsafe urls', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
  });

  it('parses traits safely', () => {
    expect(parseTraits([{ trait_type: 'Color', value: 'Blue' }, { bad: true }, null])).toEqual([
      { traitType: 'Color', value: 'Blue' },
    ]);
  });
});
