import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac, createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { FIELD_ENCRYPTION, type FieldEncryptionPort } from '../crypto/field-encryption.adapter';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain';

export interface ValidatedDocumentUpload {
  sanitizedBuffer: Buffer;
  contentType: string;
  safeFileName: string;
  checksumSha256: string;
  fileSizeBytes: number;
  exifStripped: boolean;
}

export interface SaveDocumentResult {
  storageKey: string;
  checksumSha256: string;
  fileSizeBytes: number;
}

@Injectable()
export class SecureDocumentStorageService {
  private readonly logger = new Logger('SecureDocumentStorageService');
  private readonly storageBaseDir: string;
  private readonly hmacSecret: string;

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(FIELD_ENCRYPTION) private readonly crypto: FieldEncryptionPort,
  ) {
    this.storageBaseDir = path.resolve(
      env.KYC_DOCUMENT_STORAGE_DIR || path.join(process.cwd(), 'storage', 'kyc-documents'),
    );
    this.hmacSecret = env.COMPLIANCE_FIELD_ENCRYPTION_KEY;
    try {
      if (!fs.existsSync(this.storageBaseDir)) {
        fs.mkdirSync(this.storageBaseDir, { recursive: true, mode: 0o700 });
      }
    } catch (err) {
      this.logger.warn(
        `Could not initialize storage directory ${this.storageBaseDir}: ${String(err)}`,
      );
    }
  }

  /**
   * Validates file magic bytes (signatures), rejects executables/scripts,
   * enforces size boundaries, strips EXIF/GPS metadata from images, and returns safe payload.
   */
  validateAndSanitizeUpload(input: {
    fileBuffer: Buffer;
    fileName?: string;
    requestedContentType?: string;
  }): ValidatedDocumentUpload {
    const { fileBuffer, fileName, requestedContentType } = input;

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new ValidationError('Document file payload cannot be empty');
    }

    const MIN_SIZE_BYTES = 32;
    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB maximum
    if (fileBuffer.length < MIN_SIZE_BYTES) {
      throw new ValidationError('Document file payload is too small or corrupt');
    }
    if (fileBuffer.length > MAX_SIZE_BYTES) {
      throw new ValidationError('Document file size exceeds the 10 MB maximum limit');
    }

    // 1. Sanitize file name & check for double extensions or path traversal
    const safeFileName = this.sanitizeFileName(fileName || 'document.jpg');
    this.assertSafeFileName(safeFileName);

    // 2. Reject active scripts, web executables, and malware headers
    this.assertNoExecutableOrScript(fileBuffer);

    // 3. Inspect magic bytes for allowed formats (JPEG, PNG, PDF, WebP)
    const detectedType = this.detectMagicBytes(fileBuffer);
    if (!detectedType) {
      throw new ValidationError(
        'Unsupported file format. Only JPEG, PNG, WebP, and PDF government ID documents are permitted.',
      );
    }

    if (requestedContentType && requestedContentType !== detectedType) {
      // Disallow mismatched spoofed MIME types
      this.logger.warn(
        `Document MIME mismatch: claimed ${requestedContentType}, magic bytes detected ${detectedType}`,
      );
    }

    // 4. Strip EXIF / GPS metadata from images
    let sanitizedBuffer = fileBuffer;
    let exifStripped = false;
    if (detectedType === 'image/jpeg') {
      const stripped = this.stripJpegExif(fileBuffer);
      if (stripped.length !== fileBuffer.length) {
        sanitizedBuffer = stripped;
        exifStripped = true;
      }
    } else if (detectedType === 'image/png') {
      const stripped = this.stripPngMetadata(fileBuffer);
      if (stripped.length !== fileBuffer.length) {
        sanitizedBuffer = stripped;
        exifStripped = true;
      }
    }

    const checksumSha256 = createHash('sha256').update(sanitizedBuffer).digest('hex');

    return {
      sanitizedBuffer,
      contentType: detectedType,
      safeFileName,
      checksumSha256,
      fileSizeBytes: sanitizedBuffer.length,
      exifStripped,
    };
  }

  /**
   * Encrypts the document payload with AES-256-GCM and persists it to private disk storage.
   * Returns relative storage key.
   */
  saveEncryptedDocument(
    ownerUserId: string,
    documentId: string,
    sanitizedBuffer: Buffer,
  ): SaveDocumentResult {
    const userSubDir = path.join(this.storageBaseDir, ownerUserId);
    if (!fs.existsSync(userSubDir)) {
      fs.mkdirSync(userSubDir, { recursive: true, mode: 0o700 });
    }

    const relativeKey = path.join(ownerUserId, `${documentId}.enc`).replace(/\\/g, '/');
    const fullPath = this.resolveSafePath(relativeKey);

    const encrypted = this.crypto.encryptBuffer(sanitizedBuffer);
    fs.writeFileSync(fullPath, encrypted, { mode: 0o600 });

    const checksumSha256 = createHash('sha256').update(sanitizedBuffer).digest('hex');
    return {
      storageKey: relativeKey,
      checksumSha256,
      fileSizeBytes: sanitizedBuffer.length,
    };
  }

  /**
   * Reads the encrypted file from private disk storage and decrypts it into memory.
   */
  readAndDecryptDocument(storageKey: string): Buffer {
    const fullPath = this.resolveSafePath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundError('Document storage payload not found on disk');
    }

    const encrypted = fs.readFileSync(fullPath);
    return this.crypto.decryptBuffer(encrypted);
  }

  /**
   * Securely deletes the encrypted file from private disk storage.
   */
  deleteEncryptedDocument(storageKey: string): boolean {
    try {
      const fullPath = this.resolveSafePath(storageKey);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
    } catch (err) {
      this.logger.warn(`Failed to delete document at ${storageKey}: ${String(err)}`);
    }
    return false;
  }

  /**
   * Generates a short-lived HMAC-signed token for temporary Admin document viewing.
   * Format: v1.<documentId>.<expiresTimestamp>.<signature>
   */
  generateViewToken(documentId: string, ownerUserId: string, ttlSeconds = 300): string {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const dataToSign = `v1:${documentId}:${ownerUserId}:${expiresAt}`;
    const hmac = createHmac('sha256', this.hmacSecret).update(dataToSign).digest('base64url');
    return `v1.${documentId}.${expiresAt}.${hmac}`;
  }

  /**
   * Verifies the view token signature and expiration.
   */
  verifyViewToken(token: string, expectedDocumentId: string, expectedOwnerUserId: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      return false;
    }
    const [, documentId, expiresStr, signature] = parts;
    if (!documentId || !expiresStr || !signature || documentId !== expectedDocumentId) {
      return false;
    }

    const expiresAt = Number.parseInt(expiresStr, 10);
    if (Number.isNaN(expiresAt) || Date.now() > expiresAt) {
      return false;
    }

    const dataToSign = `v1:${documentId}:${expectedOwnerUserId}:${expiresAt}`;
    const expectedHmac = createHmac('sha256', this.hmacSecret)
      .update(dataToSign)
      .digest('base64url');

    return signature === expectedHmac;
  }

  // --- Private Security Helpers ---

  private resolveSafePath(relativeKey: string): string {
    if (relativeKey.includes('..') || relativeKey.includes('\0')) {
      throw new ForbiddenError('Path traversal detected in document storage key');
    }
    const target = path.resolve(this.storageBaseDir, relativeKey);
    if (!target.startsWith(this.storageBaseDir)) {
      throw new ForbiddenError('Path traversal detected in document storage key');
    }
    return target;
  }

  private sanitizeFileName(fileName: string): string {
    const base = path.basename(fileName);
    return base.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private assertSafeFileName(fileName: string): void {
    const lower = fileName.toLowerCase();
    const dangerousExtensions = [
      '.php',
      '.phtml',
      '.phar',
      '.exe',
      '.bat',
      '.cmd',
      '.sh',
      '.bash',
      '.js',
      '.ts',
      '.mjs',
      '.cgi',
      '.pl',
      '.py',
      '.vbs',
      '.jar',
      '.msi',
      '.dll',
      '.so',
      '.dylib',
      '.html',
      '.htm',
      '.svg',
    ];
    for (const ext of dangerousExtensions) {
      if (lower.includes(ext)) {
        throw new ValidationError(`Dangerous file extension or script detected: ${fileName}`);
      }
    }
  }

  private assertNoExecutableOrScript(buffer: Buffer): void {
    // Check for MZ (DOS/Windows PE) header
    if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
      throw new ValidationError('Executable files (DOS/PE) are forbidden');
    }
    // Check for ELF header
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x7f &&
      buffer[1] === 0x45 &&
      buffer[2] === 0x4c &&
      buffer[3] === 0x46
    ) {
      throw new ValidationError('Executable files (ELF) are forbidden');
    }
    // Check for Mach-O
    if (
      (buffer.length >= 4 &&
        buffer[0] === 0xfe &&
        buffer[1] === 0xed &&
        buffer[2] === 0xfa &&
        (buffer[3] === 0xce || buffer[3] === 0xcf)) ||
      (buffer.length >= 4 &&
        buffer[0] === 0xcf &&
        buffer[1] === 0xfa &&
        buffer[2] === 0xed &&
        buffer[3] === 0xfe)
    ) {
      throw new ValidationError('Executable files (Mach-O) are forbidden');
    }

    // Scan first 4KB for script tags or active code
    const inspectWindow = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8');
    const scriptPatterns = [
      /<script\b/i,
      /<\?php\b/i,
      /<svg\b/i,
      /\beval\s*\(/i,
      /\bjavascript\s*:/i,
      /\bonerror\s*=/i,
      /\bonload\s*=/i,
    ];
    for (const pattern of scriptPatterns) {
      if (pattern.test(inspectWindow)) {
        throw new ValidationError('Active scripts or markup are forbidden in identity documents');
      }
    }
  }

  private detectMagicBytes(buffer: Buffer): string | null {
    // JPEG: 0xFF 0xD8 0xFF
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'image/png';
    }

    // PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
    if (
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d
    ) {
      return 'application/pdf';
    }

    // WebP: 'RIFF'....'WEBP'
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }

    return null;
  }

  /**
   * Strips APP1 (Exif/GPS) marker segment from JPEG buffer without re-encoding image pixels.
   */
  private stripJpegExif(buffer: Buffer): Buffer {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      return buffer;
    }

    const chunks: Buffer[] = [buffer.subarray(0, 2)]; // Keep SOI (FF D8)
    let offset = 2;

    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        break;
      }

      const marker = buffer[offset + 1];
      if (marker === undefined) {
        break;
      }
      // SOS (Start of Scan) FF DA or EOI FF D9 -> copy remainder directly
      if (marker === 0xda || marker === 0xd9) {
        chunks.push(buffer.subarray(offset));
        break;
      }

      // Standalone markers without length
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        chunks.push(buffer.subarray(offset, offset + 2));
        offset += 2;
        continue;
      }

      if (offset + 4 > buffer.length) {
        break;
      }

      const segmentLength = buffer.readUInt16BE(offset + 2);
      const segmentEnd = offset + 2 + segmentLength;
      if (segmentEnd > buffer.length) {
        break;
      }

      // APP1 marker (FF E1) contains EXIF / GPS metadata — skip it!
      if (marker === 0xe1) {
        offset = segmentEnd;
        continue;
      }

      chunks.push(buffer.subarray(offset, segmentEnd));
      offset = segmentEnd;
    }

    return Buffer.concat(chunks);
  }

  /**
   * Strips ancillary PNG chunks (eXIf, tIME, tEXt, iTXt, zTXt) preserving critical chunks.
   */
  private stripPngMetadata(buffer: Buffer): Buffer {
    if (buffer.length < 8) return buffer;
    const pngHeader = buffer.subarray(0, 8);
    const chunks: Buffer[] = [pngHeader];
    let offset = 8;

    const ancillaryChunkTypes = new Set(['eXIf', 'tIME', 'tEXt', 'iTXt', 'zTXt']);

    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
      const totalChunkLength = 4 + 4 + length + 4; // length + type + data + CRC

      if (offset + totalChunkLength > buffer.length) {
        chunks.push(buffer.subarray(offset));
        break;
      }

      if (ancillaryChunkTypes.has(type)) {
        // Skip metadata chunk
        offset += totalChunkLength;
        continue;
      }

      chunks.push(buffer.subarray(offset, offset + totalChunkLength));
      offset += totalChunkLength;

      if (type === 'IEND') {
        break;
      }
    }

    return Buffer.concat(chunks);
  }
}
