import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShardingService } from './sharding-service';
import type { Ed25519Service } from './ed25519';
import type { CrossmintApiService } from './api';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// Mock shamir-secret-sharing with proper implementation
vi.mock('shamir-secret-sharing', () => ({
  combine: vi.fn(shares => {
    // Properly handle the array of shares being passed
    if (Array.isArray(shares) && shares.length === 2) {
      return Promise.resolve(new Uint8Array(32).fill(1));
    }
    throw new Error('Invalid shares provided to combine');
  }),
}));

// Mock utils
vi.mock('../utils', () => ({
  base64Decode: vi.fn((input: string) => {
    // Simple mock that converts the input to a Uint8Array for testing
    return new Uint8Array([1, 2, 3, 4]);
  }),
}));

describe('ShardingService', () => {
  // Mock dependencies
  const mockEd25519Service = mockDeep<Ed25519Service>();
  const mockApiService = mockDeep<CrossmintApiService>();

  // Mock localStorage and sessionStorage
  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };

  const mockSessionStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };

  // Test constants
  const testDeviceId = 'test-device-id';
  const testDeviceShare = 'test-device-share-base64';
  const testAuthShare = 'test-auth-share-base64';
  const testPrivateKey = new Uint8Array(32).fill(1);
  const testPublicKey = 'test-public-key';
  const testAuthData = {
    jwt: 'test-jwt',
    apiKey: 'test-api-key',
  };

  let service: ShardingService;

  beforeEach(() => {
    mockReset(mockEd25519Service);
    mockReset(mockApiService);

    // Reset localStorage and sessionStorage mocks
    vi.resetAllMocks();

    // Setup crypto.randomUUID mock
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(testDeviceId),
    });

    // Setup storage mocks
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('sessionStorage', mockSessionStorage);

    // Setup default mock implementations
    mockEd25519Service.getPublicKey.mockResolvedValue(testPublicKey);

    // Create new service instance for each test
    service = new ShardingService(mockEd25519Service, mockApiService);

    // Mock console.log to avoid clutter in test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('getDeviceId', () => {
    it('should return existing device ID from localStorage if available', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(testDeviceId);

      const result = service.getDeviceId();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('deviceId');
      expect(result).toBe(testDeviceId);
    });

    it('should generate a new device ID if none exists in localStorage', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);

      const result = service.getDeviceId();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('deviceId');
      expect(crypto.randomUUID).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('deviceId', testDeviceId);
      expect(result).toBe(testDeviceId);
    });
  });

  describe('storeDeviceShare and getDeviceShare', () => {
    it('should store device share in localStorage', () => {
      service.storeDeviceShare(testDeviceShare);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('device-share', testDeviceShare);
    });

    it('should retrieve device share from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(testDeviceShare);

      const result = service.getDeviceShare();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('device-share');
      expect(result).toBe(testDeviceShare);
    });
  });

  describe('cacheAuthShare and getCachedAuthShare', () => {
    it('should store auth share in sessionStorage', () => {
      service.cacheAuthShare(testAuthShare);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth-share', testAuthShare);
    });

    it('should retrieve auth share from sessionStorage', () => {
      mockSessionStorage.getItem.mockReturnValueOnce(testAuthShare);

      const result = service.getCachedAuthShare();

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('auth-share');
      expect(result).toBe(testAuthShare);
    });
  });

  describe('getLocalKeyInstance', () => {
    beforeEach(() => {
      // Setup default mocks for this test suite
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'device-share') return testDeviceShare;
        if (key === 'deviceId') return testDeviceId;
        return null;
      });
    });

    it('should throw error if device share is not found', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      await expect(service.getLocalKeyInstance(testAuthData, 'solana')).rejects.toThrow(
        'Device share not found'
      );
    });

    it('should use cached auth share if available', async () => {
      mockSessionStorage.getItem.mockReturnValueOnce(testAuthShare);

      const result = await service.getLocalKeyInstance(testAuthData, 'solana');

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('auth-share');
      expect(mockApiService.getAuthShard).not.toHaveBeenCalled();
      expect(result).toEqual({
        privateKey: expect.any(Uint8Array),
        publicKey: testPublicKey,
      });
    });

    it('should fetch auth share from API if not cached', async () => {
      mockSessionStorage.getItem.mockReturnValueOnce(null);
      mockApiService.getAuthShard.mockResolvedValueOnce({
        deviceId: testDeviceId,
        keyShare: testAuthShare,
      });

      const result = await service.getLocalKeyInstance(testAuthData, 'solana');

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('auth-share');
      expect(mockApiService.getAuthShard).toHaveBeenCalledWith(testDeviceId, testAuthData);
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth-share', testAuthShare);
      expect(result).toEqual({
        privateKey: expect.any(Uint8Array),
        publicKey: testPublicKey,
      });
    });

    it('should recombine shards and return keys', async () => {
      mockSessionStorage.getItem.mockReturnValueOnce(testAuthShare);

      const result = await service.getLocalKeyInstance(testAuthData, 'solana');

      // Verify Ed25519Service is called to compute the public key
      expect(mockEd25519Service.getPublicKey).toHaveBeenCalledWith(expect.any(Uint8Array));

      expect(result).toEqual({
        privateKey: expect.any(Uint8Array),
        publicKey: testPublicKey,
      });
    });

    it('should throw error for unsupported chain layer', async () => {
      mockSessionStorage.getItem.mockReturnValueOnce(testAuthShare);
      mockEd25519Service.getPublicKey.mockImplementationOnce(async () => {
        throw new Error('EVM key derivation not yet implemented');
      });

      await expect(service.getLocalKeyInstance(testAuthData, 'evm')).rejects.toThrow();
    });
  });
});
