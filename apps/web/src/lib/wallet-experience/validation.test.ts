import {
  ASSET_DECIMALS,
  canAppendAmountDigit,
  guessAddressFamily,
  nativeGasAsset,
  parseAmount,
  recipientIssue,
  resolveNamePreview,
  truncateMiddle,
  validateAddressFormat,
  validateSendAmount,
} from './validation';

describe('send validation', () => {
  it('rejects empty, zero, negative, over-balance, and extra decimals', () => {
    expect(validateSendAmount('', 8, 'ETH').ok).toBe(false);
    expect(validateSendAmount('0', 8, 'ETH').ok).toBe(false);
    expect(validateSendAmount('-1', 8, 'ETH').ok).toBe(false);
    expect(validateSendAmount('9', 8, 'ETH').ok).toBe(false);
    expect(validateSendAmount('1.1234567890123456789', 8, 'ETH').ok).toBe(false);
    expect(validateSendAmount('1.5', 8, 'ETH').ok).toBe(true);
    expect(parseAmount('0')).toBeNull();
  });

  it('uses asset-native decimal limits', () => {
    expect(ASSET_DECIMALS.BTC).toBe(8);
    expect(ASSET_DECIMALS.USDC).toBe(6);
    expect(canAppendAmountDigit('1.123456', '7', 6)).toBe(false);
    expect(canAppendAmountDigit('1.12345', '6', 6)).toBe(true);
  });

  it('does not silently rewrite a mismatched network address', () => {
    const btc = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    expect(guessAddressFamily(btc)).toBe('bitcoin');
    const issue = recipientIssue(btc, 'ethereum');
    expect(issue.kind).toBe('unsupported_network');
    expect(issue.message).toMatch(/Bitcoin/i);
    expect(validateAddressFormat(btc, 'ethereum').ok).toBe(false);
  });

  it('flags empty and invalid formats without correcting them', () => {
    expect(recipientIssue('', 'ethereum').kind).toBe('empty');
    expect(recipientIssue('0xdead', 'ethereum').kind).toBe('invalid_format');
    expect(recipientIssue('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 'ethereum').kind).toBe(
      'ok',
    );
  });

  it('names the native gas asset per network', () => {
    expect(nativeGasAsset('ethereum')).toBe('ETH');
    expect(nativeGasAsset('bitcoin')).toBe('BTC');
    expect(nativeGasAsset('solana')).toBe('SOL');
  });

  it('does not substitute a dummy address for ENS-style names', () => {
    const resolved = resolveNamePreview('vitalik.eth');
    expect(resolved.ok).toBe(false);
    expect(resolved.address).toBeUndefined();
    expect(validateAddressFormat('vitalik.eth', 'ethereum').ok).toBe(false);
  });
});
