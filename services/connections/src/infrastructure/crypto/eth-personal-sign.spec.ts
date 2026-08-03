import { recoverPersonalSignAddress, addressesEqual } from './eth-personal-sign';

describe('eth personal_sign recovery helpers', () => {
  it('rejects malformed signatures', () => {
    expect(recoverPersonalSignAddress('hello', '0x1234')).toBeNull();
    expect(recoverPersonalSignAddress('hello', 'not-hex')).toBeNull();
  });

  it('compares addresses case-insensitively', () => {
    expect(
      addressesEqual(
        '0xAbCDef0000000000000000000000000000000001',
        '0xabcdef0000000000000000000000000000000001',
      ),
    ).toBe(true);
  });
});
