import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyManagerService } from './key-manager';
import type { CrossmintApiService } from '../api';
import type { DeviceService } from './device';
import type { EncryptionService } from '../encryption';
import { CrossmintHttpError } from '../api/request';

describe('KeyManagerService', () => {
  let keyManagerService: KeyManagerService;
  let mockApiService: Partial<CrossmintApiService>;
  let mockDeviceService: Partial<DeviceService>;
  let mockEncryptionService: Partial<EncryptionService>;

  const MOCK_SIGNER_ID = 'signer-id-123';
  const MOCK_ENCRYPTED_MASTER_KEY = JSON.stringify({
    ciphertext: 'encrypted-key-ciphertext',
    encapsulatedKey: 'encrypted-key-encapsulated-key',
  });
  const MOCK_DECRYPTED_MASTER_SECRET = new Uint8Array([1, 2, 3]);
  const MOCK_AUTH_DATA = { jwt: 'test-jwt', apiKey: 'test-api-key' };
  const MOCK_DEVICE_ID = 'device-id-456';

  beforeEach(() => {
    mockApiService = {
      getAuthShard: vi.fn(),
    };
    mockDeviceService = {
      getId: vi.fn().mockReturnValue(MOCK_DEVICE_ID),
    };
    mockEncryptionService = {
      decrypt: vi.fn().mockResolvedValue({
        masterSecret: Buffer.from(MOCK_DECRYPTED_MASTER_SECRET).toString('base64'),
      }),
    };

    keyManagerService = new KeyManagerService(
      mockApiService as CrossmintApiService,
      mockDeviceService as DeviceService,
      mockEncryptionService as EncryptionService
    );

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should set and return the signer ID', () => {
    keyManagerService.setEncryptedMasterKey(MOCK_SIGNER_ID, MOCK_ENCRYPTED_MASTER_KEY);
    expect(keyManagerService.getSignerId()).toBe(MOCK_SIGNER_ID);
  });

  it('should return cached master secret if available', async () => {
    keyManagerService.setEncryptedMasterKey(MOCK_SIGNER_ID, MOCK_ENCRYPTED_MASTER_KEY);
    await keyManagerService.getMasterSecret(MOCK_AUTH_DATA); // First call to decrypt and cache

    // Reset mocks to ensure they are not called again
    if (mockApiService.getAuthShard) {
      vi.mocked(mockApiService.getAuthShard).mockClear();
    }
    if (mockEncryptionService.decrypt) {
      vi.mocked(mockEncryptionService.decrypt).mockClear();
    }

    const masterSecret = await keyManagerService.getMasterSecret(MOCK_AUTH_DATA);

    expect(masterSecret).toEqual(MOCK_DECRYPTED_MASTER_SECRET);
    if (mockApiService.getAuthShard) {
      expect(mockApiService.getAuthShard).not.toHaveBeenCalled();
    }
    if (mockEncryptionService.decrypt) {
      expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
    }
  });

  it('should fetch from API if encrypted key is not in memory', async () => {
    if (mockApiService.getAuthShard) {
      vi.mocked(mockApiService.getAuthShard).mockResolvedValue({
        signerId: MOCK_SIGNER_ID,
        encryptedMasterKey: MOCK_ENCRYPTED_MASTER_KEY,
      });
    }

    const masterSecret = await keyManagerService.getMasterSecret(MOCK_AUTH_DATA);

    expect(masterSecret).toEqual(MOCK_DECRYPTED_MASTER_SECRET);
    if (mockApiService.getAuthShard) {
      expect(mockApiService.getAuthShard).toHaveBeenCalledWith(
        MOCK_DEVICE_ID,
        undefined,
        MOCK_AUTH_DATA
      );
    }
    if (mockEncryptionService.decrypt) {
      expect(mockEncryptionService.decrypt).toHaveBeenCalled();
    }
  });

  it('should return null if API returns 404', async () => {
    if (mockApiService.getAuthShard) {
      vi.mocked(mockApiService.getAuthShard).mockRejectedValue(
        new CrossmintHttpError(404, 'Not Found', '')
      );
    }

    const masterSecret = await keyManagerService.getMasterSecret(MOCK_AUTH_DATA);

    expect(masterSecret).toBeNull();
  });

  it('should throw if decryption fails', async () => {
    keyManagerService.setEncryptedMasterKey(MOCK_SIGNER_ID, MOCK_ENCRYPTED_MASTER_KEY);
    if (mockEncryptionService.decrypt) {
      vi.mocked(mockEncryptionService.decrypt).mockRejectedValue(new Error('Decryption failed'));
    }

    await expect(keyManagerService.getMasterSecret(MOCK_AUTH_DATA)).rejects.toThrow(
      'Failed to decrypt master key'
    );
  });

  it('should clear all cached data', async () => {
    keyManagerService.setEncryptedMasterKey(MOCK_SIGNER_ID, MOCK_ENCRYPTED_MASTER_KEY);
    await keyManagerService.getMasterSecret(MOCK_AUTH_DATA);

    keyManagerService.clearCache();

    expect(keyManagerService.getSignerId()).toBeNull();

    // To check masterSecret and encryptedMasterKey are cleared, we see if it tries to fetch from API again
    if (mockApiService.getAuthShard) {
      vi.mocked(mockApiService.getAuthShard).mockResolvedValue({
        signerId: MOCK_SIGNER_ID,
        encryptedMasterKey: MOCK_ENCRYPTED_MASTER_KEY,
      });
    }
    await keyManagerService.getMasterSecret(MOCK_AUTH_DATA);
    if (mockApiService.getAuthShard) {
      expect(mockApiService.getAuthShard).toHaveBeenCalledTimes(1);
    }
  });
});
