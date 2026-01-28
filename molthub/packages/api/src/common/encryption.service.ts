import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-encryption-key-32-chars!';
    // Derive a 32-byte key using SHA-256
    this.key = crypto.createHash('sha256').update(encryptionKey).digest();
  }

  /**
   * Encrypts a string using AES-256-GCM
   */
  encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypts a string using AES-256-GCM
   */
  decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Encrypts a JSON object and returns a serialized string
   */
  encryptJson(data: Record<string, any>): string {
    const jsonString = JSON.stringify(data);
    const { encrypted, iv, tag } = this.encrypt(jsonString);
    return JSON.stringify({ encrypted, iv, tag, v: 1 });
  }

  /**
   * Decrypts a serialized encrypted string back to a JSON object
   */
  decryptJson(encryptedData: string): Record<string, any> {
    try {
      const parsed = JSON.parse(encryptedData);
      
      // Check if this is encrypted data
      if (parsed.encrypted && parsed.iv && parsed.tag) {
        const decrypted = this.decrypt(parsed.encrypted, parsed.iv, parsed.tag);
        return JSON.parse(decrypted);
      }
      
      // If not encrypted, return as-is (for migration compatibility)
      return parsed;
    } catch (error) {
      // If parsing fails, might be old unencrypted format
      try {
        return JSON.parse(encryptedData);
      } catch {
        throw new Error('Failed to decrypt data');
      }
    }
  }
}
