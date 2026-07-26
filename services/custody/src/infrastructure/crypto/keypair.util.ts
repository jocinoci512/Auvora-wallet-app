import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto';
import type { KeyAlgorithmCode } from '../../domain';

function curveFamily(algorithm: KeyAlgorithmCode): 'ec' | 'ed25519' {
  switch (algorithm) {
    case 'ED25519':
      return 'ed25519';
    case 'SECP256K1':
    case 'BITCOIN_SECP256K1':
    case 'ETHEREUM_SECP256K1':
      return 'ec';
    default:
      throw new Error(`Unsupported key algorithm: ${algorithm}`);
  }
}

export interface SimulatedKeyPair {
  publicKey: string;
  privateKey: string;
}

export function generateSimulatedKeyPair(algorithm: KeyAlgorithmCode): SimulatedKeyPair {
  const family = curveFamily(algorithm);
  const { publicKey, privateKey } =
    family === 'ed25519'
      ? generateKeyPairSync('ed25519', {
          publicKeyEncoding: { type: 'spki', format: 'der' },
          privateKeyEncoding: { type: 'pkcs8', format: 'der' },
        })
      : generateKeyPairSync('ec', {
          namedCurve: 'secp256k1',
          publicKeyEncoding: { type: 'spki', format: 'der' },
          privateKeyEncoding: { type: 'pkcs8', format: 'der' },
        });
  return { publicKey: publicKey.toString('base64'), privateKey: privateKey.toString('base64') };
}

export function signWithSimulatedKey(
  algorithm: KeyAlgorithmCode,
  privateKeyBase64: string,
  payloadHashHex: string,
): string {
  const family = curveFamily(algorithm);
  const privateKey = createPrivateKey({
    key: Buffer.from(privateKeyBase64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  const data = Buffer.from(payloadHashHex, 'hex');
  const signature = family === 'ed25519' ? cryptoSign(null, data, privateKey) : cryptoSign('sha256', data, privateKey);
  return signature.toString('base64');
}

export function verifySimulatedSignature(
  algorithm: KeyAlgorithmCode,
  publicKeyBase64: string,
  payloadHashHex: string,
  signatureBase64: string,
): boolean {
  try {
    const family = curveFamily(algorithm);
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const data = Buffer.from(payloadHashHex, 'hex');
    const signature = Buffer.from(signatureBase64, 'base64');
    return family === 'ed25519'
      ? cryptoVerify(null, data, publicKey, signature)
      : cryptoVerify('sha256', data, publicKey, signature);
  } catch {
    return false;
  }
}
