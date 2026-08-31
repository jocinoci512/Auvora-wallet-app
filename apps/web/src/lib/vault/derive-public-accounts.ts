/**
 * Client-only HD public-address derivation (matches mobile HdDerivation paths).
 * Never logs or returns private keys / seed material.
 */

import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';
import { getPublicKey } from '@noble/secp256k1';

export type DerivedPublicAccount = {
  network: 'ETHEREUM' | 'BNB_SMART_CHAIN' | 'POLYGON';
  assetCode: 'ETH' | 'BNB' | 'POL';
  address: string;
  path: string;
  accountIndex: number;
};

function checksumAddress(addrLowerNo0x: string): string {
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(addrLowerNo0x)));
  let out = '0x';
  for (let i = 0; i < addrLowerNo0x.length; i += 1) {
    const ch = addrLowerNo0x[i]!;
    out += parseInt(hash[i]!, 16) >= 8 ? ch.toUpperCase() : ch;
  }
  return out;
}

function ethereumAddressFromPrivateKey(privateKey: Uint8Array): string {
  const pub = getPublicKey(privateKey, false); // 65 bytes: 0x04 || X || Y
  const hash = keccak_256(pub.slice(1));
  const addr = bytesToHex(hash.slice(12));
  return checksumAddress(addr);
}

/**
 * Derive EVM public accounts from a BIP-39 mnemonic (account 0).
 * Paths match Android: m/44'/60'/0'/0/0 for ETH/BNB/Polygon.
 */
export function deriveEvmPublicAccounts(
  mnemonic: string,
  accountIndex = 0,
): DerivedPublicAccount[] {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error('Invalid recovery material for address derivation.');
  }
  const seed = mnemonicToSeedSync(normalized);
  const path = `m/44'/60'/${accountIndex}'/0/0`;
  const node = HDKey.fromMasterSeed(seed).derive(path);
  if (!node.privateKey) {
    throw new Error('Could not derive account key material.');
  }
  const address = ethereumAddressFromPrivateKey(node.privateKey);
  node.privateKey.fill(0);

  return [
    { network: 'ETHEREUM', assetCode: 'ETH', address, path, accountIndex },
    { network: 'BNB_SMART_CHAIN', assetCode: 'BNB', address, path, accountIndex },
    { network: 'POLYGON', assetCode: 'POL', address, path, accountIndex },
  ];
}

export function primaryEthereumAddress(mnemonic: string): string {
  return deriveEvmPublicAccounts(mnemonic)[0]!.address;
}
