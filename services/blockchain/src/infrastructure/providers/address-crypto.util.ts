import { randomBytes } from 'node:crypto';
import { getPublicKey, utils as secpUtils } from '@noble/secp256k1';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import { keccak_256 } from '@noble/hashes/sha3';
import bs58 from 'bs58';

export interface GeneratedAddress {
  address: string;
  publicKey: string;
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function base58CheckEncode(payload: Buffer): string {
  const checksum = Buffer.from(sha256(sha256(payload))).subarray(0, 4);
  return bs58.encode(Buffer.concat([payload, checksum]));
}

function toEip55Checksum(hexAddress: string): string {
  const lower = hexAddress.toLowerCase().replace(/^0x/, '');
  const hash = toHex(keccak_256(Buffer.from(lower, 'utf8')));
  let checksummed = '0x';
  for (let i = 0; i < lower.length; i += 1) {
    const hashChar = hash[i] ?? '0';
    const addrChar = lower[i] ?? '';
    checksummed += parseInt(hashChar, 16) >= 8 ? addrChar.toUpperCase() : addrChar;
  }
  return checksummed;
}

function keccakAddressFromPublicKey(publicKey: Uint8Array): string {
  const uncompressedBody = publicKey.subarray(1); // drop the 0x04 prefix
  const hash = keccak_256(uncompressedBody);
  const addressBytes = hash.subarray(hash.length - 20);
  return toEip55Checksum(`0x${toHex(addressBytes)}`);
}

/** EVM-style secp256k1 keypair + keccak-derived, EIP-55 checksummed address. */
export function generateEvmAddress(): GeneratedAddress {
  const privateKey = secpUtils.randomPrivateKey();
  const publicKey = getPublicKey(privateKey, false);
  return { address: keccakAddressFromPublicKey(publicKey), publicKey: toHex(publicKey) };
}

/** Bitcoin/Litecoin-style secp256k1 keypair + base58check P2PKH address for the given version byte. */
export function generateBase58CheckAddress(versionByte: number): GeneratedAddress {
  const privateKey = secpUtils.randomPrivateKey();
  const publicKey = getPublicKey(privateKey, true);
  const hash160 = ripemd160(sha256(publicKey));
  const payload = Buffer.concat([Buffer.from([versionByte]), Buffer.from(hash160)]);
  return { address: base58CheckEncode(payload), publicKey: toHex(publicKey) };
}

/** Simulated ed25519-shaped 32-byte pubkey rendered as base58, matching Solana's address format. */
export function generateSolanaAddress(): GeneratedAddress {
  const seed = randomBytes(32);
  const pubkeyLike = sha256(seed);
  return { address: bs58.encode(Buffer.from(pubkeyLike)), publicKey: toHex(pubkeyLike) };
}

/** TRON mainnet address: keccak-derived 20-byte hash, base58check with the 0x41 prefix ("T..."). */
export function generateTronAddress(): GeneratedAddress {
  const privateKey = secpUtils.randomPrivateKey();
  const publicKey = getPublicKey(privateKey, false);
  const uncompressedBody = publicKey.subarray(1);
  const hash = keccak_256(uncompressedBody);
  const addressBytes = hash.subarray(hash.length - 20);
  const payload = Buffer.concat([Buffer.from([0x41]), Buffer.from(addressBytes)]);
  return { address: base58CheckEncode(payload), publicKey: toHex(publicKey) };
}
