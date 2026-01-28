import { EncryptionService } from '../../src/common/encryption.service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!!';
    encryptionService = new EncryptionService();
  });

  describe('encrypt', () => {
    it('should encrypt a string', () => {
      const text = 'sensitive-data';
      const result = encryptionService.encrypt(text);

      expect(result.encrypted).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.tag).toBeDefined();
      expect(result.encrypted).not.toBe(text);
    });

    it('should produce different encrypted results for same input', () => {
      const text = 'sensitive-data';
      const result1 = encryptionService.encrypt(text);
      const result2 = encryptionService.encrypt(text);

      expect(result1.encrypted).not.toBe(result2.encrypted);
      expect(result1.iv).not.toBe(result2.iv);
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted string', () => {
      const text = 'sensitive-data';
      const encrypted = encryptionService.encrypt(text);
      const decrypted = encryptionService.decrypt(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.tag,
      );

      expect(decrypted).toBe(text);
    });
  });

  describe('encryptJson / decryptJson', () => {
    it('should encrypt and decrypt JSON objects', () => {
      const data = {
        apiKey: 'sk-1234567890',
        organizationId: 'org-123',
        nested: {
          key: 'value',
        },
      };

      const encrypted = encryptionService.encryptJson(data);
      const decrypted = encryptionService.decryptJson(encrypted);

      expect(decrypted).toEqual(data);
    });

    it('should handle plain JSON (migration compatibility)', () => {
      const data = {
        apiKey: 'sk-1234567890',
      };

      const plainJson = JSON.stringify(data);
      const decrypted = encryptionService.decryptJson(plainJson);

      expect(decrypted).toEqual(data);
    });
  });
});
