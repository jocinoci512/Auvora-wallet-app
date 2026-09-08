import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';

export const FIELD_ENCRYPTION = Symbol('FIELD_ENCRYPTION');

export interface FieldEncryptionPort {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
  hash(value: string): string;
  encryptBuffer(buffer: Buffer): Buffer;
  decryptBuffer(ciphertext: Buffer): Buffer;
}

@Injectable()
export class AesFieldEncryptionAdapter implements FieldEncryptionPort {
  private readonly key: Buffer;

  constructor(@Inject(ENV) env: ServiceEnv) {
    this.key = createHash('sha256').update(env.COMPLIANCE_FIELD_ENCRYPTION_KEY).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
  }

  decrypt(ciphertext: string): string {
    const [version, ivB64, tagB64, dataB64] = ciphertext.split(':');
    if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
      throw new Error('Invalid ciphertext format');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  encryptBuffer(buffer: Buffer): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: [1 byte version (0x01)] [12 bytes IV] [16 bytes Tag] [encrypted payload]
    return Buffer.concat([Buffer.from([0x01]), iv, tag, encrypted]);
  }

  decryptBuffer(ciphertext: Buffer): Buffer {
    if (ciphertext.length < 1 + 12 + 16) {
      throw new Error('Invalid buffer ciphertext: payload too short');
    }
    const version = ciphertext[0];
    if (version !== 0x01) {
      throw new Error(`Unsupported buffer ciphertext version: ${version}`);
    }
    const iv = ciphertext.subarray(1, 13);
    const tag = ciphertext.subarray(13, 29);
    const data = ciphertext.subarray(29);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
