import { isSupportedPublicNetwork, validatePublicAddressFormat } from './supported-networks';

describe('supported public networks', () => {
  it('allows the six Alpha networks only', () => {
    expect(isSupportedPublicNetwork('ETHEREUM')).toBe(true);
    expect(isSupportedPublicNetwork('POLYGON')).toBe(true);
    expect(isSupportedPublicNetwork('LITECOIN')).toBe(false);
  });

  it('validates address shapes per chain family', () => {
    expect(
      validatePublicAddressFormat('ETHEREUM', '0x1111111111111111111111111111111111111111'),
    ).toBe(true);
    expect(validatePublicAddressFormat('ETHEREUM', 'not-an-address')).toBe(false);
    expect(
      validatePublicAddressFormat('BITCOIN', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'),
    ).toBe(true);
    expect(validatePublicAddressFormat('TRON', 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb')).toBe(true);
    expect(
      validatePublicAddressFormat('SOLANA', '0x1111111111111111111111111111111111111111'),
    ).toBe(false);
  });
});
