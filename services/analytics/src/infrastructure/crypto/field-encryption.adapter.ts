import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';

export const FIELD_ENCRYPTION = Symbol('FIELD_ENCRYPTION');

export interface FieldEncryptionPort {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
  hash(value: string): string;
}

@Injectable()
export class AesFieldEncryptionAdapter implements FieldEncryptionPort {
  private readonly key: Buffer;

  constructor(@Inject(ENV) env: ServiceEnv) {
    this.key = createHash('sha256').update(env.ANALYTICS_FIELD_ENCRYPTION_KEY).digest();
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

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
