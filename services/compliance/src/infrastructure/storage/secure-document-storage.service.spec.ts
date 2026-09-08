import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SecureDocumentStorageService } from './secure-document-storage.service';
import { AesFieldEncryptionAdapter } from '../crypto/field-encryption.adapter';
import { ValidationError, ForbiddenError } from '../../domain';

describe('SecureDocumentStorageService', () => {
  let tempDir: string;
  let service: SecureDocumentStorageService;
  const mockEnv = {
    NODE_ENV: 'test',
    PORT: 3005,
    SERVICE_NAME: 'compliance',
    SERVICE_VERSION: '0.1.0',
    COMPLIANCE_FIELD_ENCRYPTION_KEY: 'test-key-must-be-at-least-32-characters-long!!',
    KYC_DOCUMENT_STORAGE_DIR: '',
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auvora-kyc-test-'));
    mockEnv.KYC_DOCUMENT_STORAGE_DIR = tempDir;
    const crypto = new AesFieldEncryptionAdapter(mockEnv as never);
    service = new SecureDocumentStorageService(mockEnv as never, crypto);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('validateAndSanitizeUpload', () => {
    it('accepts valid JPEG buffer and returns detected contentType', () => {
      // Valid JPEG header FF D8 FF E0 00 10 4A 46 49 46 ...
      const jpeg = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
        Buffer.from('JFIF\0\x01\x01\x01\0H\0H\0\0', 'ascii'),
        Buffer.from([0xff, 0xdb, 0x00, 0x43, 0x00]), // DQT
        Buffer.alloc(64, 1),
        Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10, 0x00, 0x10, 0x01, 0x01, 0x11, 0x00]), // SOF
        Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00]), // SOS
        Buffer.alloc(20, 0xaa),
        Buffer.from([0xff, 0xd9]), // EOI
      ]);

      const result = service.validateAndSanitizeUpload({
        fileBuffer: jpeg,
        fileName: 'front-id.jpg',
      });

      expect(result.contentType).toBe('image/jpeg');
      expect(result.safeFileName).toBe('front-id.jpg');
      expect(result.checksumSha256).toBeDefined();
    });

    it('strips APP1 EXIF segment from JPEG containing GPS markers', () => {
      // JPEG with APP1 Exif marker (FF E1 ...)
      const exifPayload = Buffer.from('Exif\0\0GPSInfoTestDataHere');
      const app1Length = exifPayload.length + 2;
      const app1Segment = Buffer.concat([
        Buffer.from([0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff]),
        exifPayload,
      ]);

      const jpegWithExif = Buffer.concat([
        Buffer.from([0xff, 0xd8]), // SOI
        app1Segment, // APP1 with GPS
        Buffer.from([0xff, 0xdb, 0x00, 0x05, 0x00, 0x01, 0x02]), // DQT
        Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00]), // SOS
        Buffer.alloc(20, 0xaa),
        Buffer.from([0xff, 0xd9]), // EOI
      ]);

      const result = service.validateAndSanitizeUpload({
        fileBuffer: jpegWithExif,
        fileName: 'passport_photo.jpeg',
      });

      expect(result.contentType).toBe('image/jpeg');
      expect(result.exifStripped).toBe(true);
      expect(result.sanitizedBuffer.includes(Buffer.from('GPSInfo'))).toBe(false);
      expect(result.sanitizedBuffer.length).toBeLessThan(jpegWithExif.length);
    });

    it('accepts valid PNG buffer and PDF buffer', () => {
      // PNG header: 89 50 4E 47 0D 0A 1A 0A
      const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(30, 0x11),
      ]);
      const pngResult = service.validateAndSanitizeUpload({
        fileBuffer: png,
        fileName: 'driver_license.png',
      });
      expect(pngResult.contentType).toBe('image/png');

      // PDF header: %PDF-1.4
      const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(40, 0x20)]);
      const pdfResult = service.validateAndSanitizeUpload({
        fileBuffer: pdf,
        fileName: 'national_id.pdf',
      });
      expect(pdfResult.contentType).toBe('application/pdf');
    });

    it('rejects executable DOS/PE files (MZ header)', () => {
      const peFile = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(60, 0x90)]);
      expect(() =>
        service.validateAndSanitizeUpload({
          fileBuffer: peFile,
          fileName: 'malicious.exe.jpg',
        }),
      ).toThrow(ValidationError);
    });

    it('rejects files containing active scripts (<script>)', () => {
      const scriptPayload = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff]),
        Buffer.from('<script>alert("xss")</script>'),
        Buffer.alloc(40, 0),
      ]);
      expect(() =>
        service.validateAndSanitizeUpload({
          fileBuffer: scriptPayload,
          fileName: 'script.jpg',
        }),
      ).toThrow(ValidationError);
    });

    it('rejects dangerous double extensions', () => {
      const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(40, 0x11)]);
      expect(() =>
        service.validateAndSanitizeUpload({
          fileBuffer: jpeg,
          fileName: 'passport.php.jpg',
        }),
      ).toThrow(ValidationError);
    });
  });

  describe('saveEncryptedDocument and readAndDecryptDocument', () => {
    it('encrypts file on disk and decrypts matching bytes into memory', () => {
      const ownerUserId = '987e6543-e21b-12d3-a456-426614174000';
      const documentId = '123e4567-e89b-12d3-a456-426614174000';
      const originalPayload = Buffer.from('SECRET_KYC_IMAGE_PAYLOAD_BINARY_TEST_DATA_12345');

      const saveResult = service.saveEncryptedDocument(ownerUserId, documentId, originalPayload);

      expect(saveResult.storageKey).toBe(`${ownerUserId}/${documentId}.enc`);

      // Verify the file on disk is NOT plaintext
      const diskPath = path.join(tempDir, ownerUserId, `${documentId}.enc`);
      const rawDiskBytes = fs.readFileSync(diskPath);
      expect(rawDiskBytes.includes(originalPayload)).toBe(false);

      // Decrypt via service
      const decrypted = service.readAndDecryptDocument(saveResult.storageKey);
      expect(decrypted.equals(originalPayload)).toBe(true);
    });

    it('prevents path traversal when reading document', () => {
      expect(() => service.readAndDecryptDocument('../../etc/passwd')).toThrow(ForbiddenError);
    });
  });

  describe('view tokens', () => {
    it('generates a valid short-lived view token and validates it', () => {
      const docId = 'doc-123';
      const userId = 'user-456';
      const token = service.generateViewToken(docId, userId, 60);

      expect(service.verifyViewToken(token, docId, userId)).toBe(true);
      expect(service.verifyViewToken(token, 'wrong-doc', userId)).toBe(false);
      expect(service.verifyViewToken(token, docId, 'wrong-user')).toBe(false);
    });

    it('rejects expired tokens', () => {
      const docId = 'doc-123';
      const userId = 'user-456';
      // -10 seconds TTL -> already expired
      const expiredToken = service.generateViewToken(docId, userId, -10);

      expect(service.verifyViewToken(expiredToken, docId, userId)).toBe(false);
    });
  });
});
