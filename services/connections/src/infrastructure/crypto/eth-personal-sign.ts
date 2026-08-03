import { keccak_256 } from '@noble/hashes/sha3';
import { recoverPublicKey } from '@noble/secp256k1';

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function normalizeHex(sig: string): string {
  return sig.startsWith('0x') ? sig.slice(2) : sig;
}

function eip55(addressHex: string): string {
  const lower = addressHex.toLowerCase().replace(/^0x/, '');
  const hash = toHex(keccak_256(Buffer.from(lower, 'utf8')));
  let out = '0x';
  for (let i = 0; i < lower.length; i += 1) {
    const h = hash[i] ?? '0';
    const c = lower[i] ?? '';
    out += parseInt(h, 16) >= 8 ? c.toUpperCase() : c;
  }
  return out;
}

function publicKeyToAddress(publicKey: Uint8Array): string {
  const body = publicKey.length === 65 ? publicKey.subarray(1) : publicKey;
  const hash = keccak_256(body);
  return eip55(`0x${toHex(hash.subarray(12))}`);
}

function ethSignedMessageHash(message: string): Uint8Array {
  const msgBytes = Buffer.from(message, 'utf8');
  const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${msgBytes.length}`, 'utf8');
  return keccak_256(Buffer.concat([prefix, msgBytes]));
}

/**
 * Recover signer address from an eth_personal_sign / personal_sign signature.
 * Returns null when the signature cannot be recovered.
 */
export function recoverPersonalSignAddress(message: string, signature: string): string | null {
  try {
    const hex = normalizeHex(signature);
    if (hex.length !== 130) return null;
    const r = hex.slice(0, 64);
    const s = hex.slice(64, 128);
    const vRaw = parseInt(hex.slice(128, 130), 16);
    const recovery = vRaw >= 27 ? vRaw - 27 : vRaw;
    if (recovery !== 0 && recovery !== 1) return null;

    const hash = ethSignedMessageHash(message);
    const pub = recoverPublicKey(toHex(hash), r + s, recovery, false);
    if (!pub) return null;
    return publicKeyToAddress(pub);
  } catch {
    return null;
  }
}

export function addressesEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
