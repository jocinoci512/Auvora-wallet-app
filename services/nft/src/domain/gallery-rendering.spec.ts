import { sanitizeText, sanitizeUrl, parseTraits } from './metadata-sanitizer';

describe('gallery / metadata rendering helpers', () => {
  it('sanitizes unsafe metadata for gallery display', () => {
    expect(sanitizeText('<script>alert(1)</script>Art')).not.toMatch(/script/i);
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
  });

  it('parses traits safely for gallery filters', () => {
    const traits = parseTraits([
      { trait_type: 'Background', value: 'Blue' },
      { trait_type: '<script>', value: 'x' },
      null,
    ]);
    expect(traits[0]).toMatchObject({ traitType: 'Background', value: 'Blue' });
    expect(traits.every((t) => !/<script/i.test(t.traitType))).toBe(true);
  });
});
