import { ChainNetwork } from '@auvora/database';

const BASE58_ALPHABET = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function isValidBitcoinAddress(address: string): boolean {
  if (typeof address !== 'string' || address.length === 0) {
    return false;
  }
  if (/^bc1[a-z0-9]{25,62}$/.test(address)) {
    return true;
  }
  return /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
}

export function isValidLitecoinAddress(address: string): boolean {
  if (typeof address !== 'string' || address.length === 0) {
    return false;
  }
  if (/^ltc1[a-z0-9]{25,62}$/.test(address)) {
    return true;
  }
  return /^[LM3][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
}

export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidSolanaAddress(address: string): boolean {
  return address.length >= 32 && address.length <= 44 && BASE58_ALPHABET.test(address);
}

export function isValidTronAddress(address: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

export function validateAddressForChain(chain: ChainNetwork, address: string): boolean {
  if (typeof address !== 'string' || address.trim().length === 0) {
    return false;
  }
  switch (chain) {
    case ChainNetwork.BITCOIN:
      return isValidBitcoinAddress(address);
    case ChainNetwork.LITECOIN:
      return isValidLitecoinAddress(address);
    case ChainNetwork.ETHEREUM:
    case ChainNetwork.POLYGON:
    case ChainNetwork.BNB_SMART_CHAIN:
      return isValidEvmAddress(address);
    case ChainNetwork.SOLANA:
      return isValidSolanaAddress(address);
    case ChainNetwork.TRON:
      return isValidTronAddress(address);
    default:
      return false;
  }
}
