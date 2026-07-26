import { localFormatValidateAddress } from './blockchain-http-client.adapter';

describe('localFormatValidateAddress', () => {
  it('accepts valid ethereum-format addresses', () => {
    expect(localFormatValidateAddress('ETHEREUM', '0x' + 'a'.repeat(40))).toBe(true);
    expect(localFormatValidateAddress('polygon', '0x' + 'b'.repeat(40))).toBe(true);
  });

  it('rejects invalid and unknown chains (fail-closed)', () => {
    expect(localFormatValidateAddress('ETHEREUM', 'not-an-address')).toBe(false);
    expect(localFormatValidateAddress('UNKNOWN_CHAIN', '0x' + 'a'.repeat(40))).toBe(false);
    expect(localFormatValidateAddress('ETHEREUM', '')).toBe(false);
  });
});
