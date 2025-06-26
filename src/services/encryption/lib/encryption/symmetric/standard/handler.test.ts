import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SymmetricEncryptionHandler } from './handler';
import { type SymmetricKeyProvider } from '../../../key-management/provider';

describe('SymmetricEncryptionHandler', () => {
  let key: CryptoKey;
  let mockKeyProvider: SymmetricKeyProvider;

  beforeEach(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);

    mockKeyProvider = {
      getSymmetricKey: vi.fn().mockResolvedValue(key),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should encrypt and decrypt data successfully', async () => {
    const handler = new SymmetricEncryptionHandler(mockKeyProvider);
    const originalData = new TextEncoder().encode('hello world');

    const encryptedData = await handler.encrypt(originalData);
    const decryptedData = await handler.decrypt(encryptedData);

    expect(decryptedData).toEqual(originalData);
    expect(new TextDecoder().decode(decryptedData)).toBe('hello world');
  });

  it('should use a different IV for each encryption', async () => {
    const handler = new SymmetricEncryptionHandler(mockKeyProvider);
    const originalData = new TextEncoder().encode('hello world');

    const encryptedData1 = await handler.encrypt(originalData);
    const encryptedData2 = await handler.encrypt(originalData);

    expect(encryptedData1).not.toEqual(encryptedData2);

    const ivLength = 12;
    const iv1 = encryptedData1.slice(0, ivLength);
    const iv2 = encryptedData2.slice(0, ivLength);
    expect(iv1).not.toEqual(iv2);
  });
});
