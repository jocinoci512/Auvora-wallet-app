import { guessDeviceName } from './device';

describe('device helpers', () => {
  it('returns a browser device label', () => {
    const name = guessDeviceName();
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(3);
  });
});
