import { ChainNetwork } from '@auvora/database';
import {
  isValidBitcoinAddress,
  isValidEvmAddress,
  isValidLitecoinAddress,
  isValidSolanaAddress,
  isValidTronAddress,
  validateAddressForChain,
} from './address-rules';

describe('address-rules', () => {
  describe('isValidBitcoinAddress', () => {
    it('accepts legacy P2PKH addresses', () => {
      expect(isValidBitcoinAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true);
    });
    it('accepts bech32 addresses', () => {
      expect(isValidBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(true);
    });
    it('rejects malformed addresses', () => {
      expect(isValidBitcoinAddress('not-an-address')).toBe(false);
      expect(isValidBitcoinAddress('')).toBe(false);
    });
  });

  describe('isValidLitecoinAddress', () => {
    it('accepts L-prefixed addresses', () => {
      expect(isValidLitecoinAddress('LNL5W1VunEFqzMBP4LC6oXeXjqvcYSPzhK')).toBe(true);
    });
    it('rejects bitcoin-style addresses', () => {
      expect(isValidLitecoinAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(false);
    });
  });

  describe('isValidEvmAddress', () => {
    it('accepts 0x + 40 hex chars', () => {
      expect(isValidEvmAddress('0x' + 'a'.repeat(40))).toBe(true);
    });
    it('rejects wrong length', () => {
      expect(isValidEvmAddress('0x' + 'a'.repeat(39))).toBe(false);
    });
    it('rejects missing prefix', () => {
      expect(isValidEvmAddress('a'.repeat(40))).toBe(false);
    });
  });

  describe('isValidSolanaAddress', () => {
    it('accepts base58 pubkeys of the correct length', () => {
      expect(isValidSolanaAddress('4Nd1mYJq5eGoWzZ4hVYuQK5jN9tCLKgLQmDzYy1P8n2X')).toBe(true);
    });
    it('rejects addresses containing invalid base58 characters', () => {
      expect(isValidSolanaAddress('0OIl'.padEnd(32, '1'))).toBe(false);
    });
  });

  describe('isValidTronAddress', () => {
    it('accepts T-prefixed 34-char base58 addresses', () => {
      expect(isValidTronAddress('T' + 'A'.repeat(33))).toBe(true);
    });
    it('rejects addresses without T prefix', () => {
      expect(isValidTronAddress('A'.repeat(34))).toBe(false);
    });
  });

  describe('validateAddressForChain', () => {
    it('routes each chain to the correct validator', () => {
      expect(validateAddressForChain(ChainNetwork.BITCOIN, '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true);
      expect(validateAddressForChain(ChainNetwork.LITECOIN, 'LNL5W1VunEFqzMBP4LC6oXeXjqvcYSPzhK')).toBe(true);
      expect(validateAddressForChain(ChainNetwork.ETHEREUM, '0x' + 'a'.repeat(40))).toBe(true);
      expect(validateAddressForChain(ChainNetwork.POLYGON, '0x' + 'b'.repeat(40))).toBe(true);
      expect(validateAddressForChain(ChainNetwork.BNB_SMART_CHAIN, '0x' + 'c'.repeat(40))).toBe(true);
      expect(validateAddressForChain(ChainNetwork.SOLANA, '4Nd1mYJq5eGoWzZ4hVYuQK5jN9tCLKgLQmDzYy1P8n2X')).toBe(
        true,
      );
      expect(validateAddressForChain(ChainNetwork.TRON, 'T' + 'A'.repeat(33))).toBe(true);
    });

    it('rejects empty or whitespace-only addresses', () => {
      expect(validateAddressForChain(ChainNetwork.BITCOIN, '')).toBe(false);
      expect(validateAddressForChain(ChainNetwork.BITCOIN, '   ')).toBe(false);
    });
  });
});
