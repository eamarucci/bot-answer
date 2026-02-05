import { createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Decrypts a string that was encrypted using AES-256-GCM
 * @param encryptedText - The encrypted string in format: iv:authTag:encrypted
 * @param key - The encryption key (32 bytes as hex string)
 * @returns Decrypted string
 */
export function decrypt(encryptedText: string, key: string): string {
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format. Expected iv:authTag:encrypted');
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const keyBuffer = Buffer.from(key, 'hex');
  
  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }
  
  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
