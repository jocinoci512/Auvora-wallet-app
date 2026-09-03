#!/usr/bin/env node
/** LOCAL QA — public Solana address from BIP39 via SLIP-0010. No secret output. */
import { createHmac, createPrivateKey, pbkdf2Sync } from 'node:crypto';

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function mnemonicToSeed(mnemonic) {
  return pbkdf2Sync(mnemonic.normalize('NFKD'), 'mnemonic', 2048, 64, 'sha512');
}

function slip10Master(seed) {
  const I = createHmac('sha512', 'ed25519 seed').update(seed).digest();
  return { key: I.subarray(0, 32), chainCode: I.subarray(32) };
}

function slip10Hardened(node, index) {
  const data = Buffer.alloc(37);
  data[0] = 0;
  Buffer.from(node.key).copy(data, 1);
  const h = (index + 0x80000000) >>> 0;
  data.writeUInt32BE(h, 33);
  const I = createHmac('sha512', node.chainCode).update(data).digest();
  return { key: I.subarray(0, 32), chainCode: I.subarray(32) };
}

function base58Encode(bytes) {
  let zeros = 0;
  for (const b of bytes) {
    if (b === 0) zeros++;
    else break;
  }
  let hex = Buffer.from(bytes).toString('hex');
  if (hex.length === 0) hex = '00';
  let x = BigInt('0x' + hex);
  let out = '';
  while (x > 0n) {
    const mod = Number(x % 58n);
    x /= 58n;
    out = alphabet[mod] + out;
  }
  return '1'.repeat(zeros) + (out || '');
}

function pubkeyFromSeed(seed32) {
  const derPrefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const pkcs8 = Buffer.concat([derPrefix, Buffer.from(seed32)]);
  const key = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const spki = key.export({ type: 'spki', format: 'der' });
  // SPKI for ed25519 ends with the 32-byte raw public key
  return spki.subarray(spki.length - 32);
}

function solanaAddress(mnemonic) {
  const seed = mnemonicToSeed(mnemonic);
  let node = slip10Master(seed);
  for (const i of [44, 501, 0, 0]) node = slip10Hardened(node, i);
  return base58Encode(pubkeyFromSeed(node.key));
}

const mnemonic =
  process.argv[2] ??
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
console.log(solanaAddress(mnemonic));
