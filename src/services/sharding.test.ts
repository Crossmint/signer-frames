import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShardingService } from './sharding';
import type { CrossmintApiService } from './api';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// Create a reusable mock value for the master secret
const MOCK_MASTER_SECRET = new Uint8Array(32).fill(1);

// Define mocks FIRST before importing any modules that use them
vi.mock('shamir-secret-sharing', () => {
  return {
    combine: vi.fn().mockImplementation(() => Promise.resolve(MOCK_MASTER_SECRET)),
  };
});

// Now import shamir after mocking
import * as shamir from 'shamir-secret-sharing';

// Make mocked combine function available
const mockCombine = shamir.combine as jest.Mock;

// Mock atob function for base64 decoding
vi.stubGlobal(
  'atob',
  vi.fn(base64 => {
    // Simple mock implementation of atob
    // This just returns a dummy string to generate a Uint8Array from
    return 'ABCD';
  })
);

describe('ShardingService', () => {
  // Mock dependencies
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
  const testAuthData = {
    jwt: 'test-jwt',
    apiKey: 'test-api-key',
  };

  let service: ShardingService;

  beforeEach(() => {
    mockReset(mockApiService);

    // Reset localStorage and sessionStorage mocks
    vi.resetAllMocks();

    // Make sure the combine mock returns a promise with the expected value
    mockCombine.mockClear();
    mockCombine.mockImplementation(() => Promise.resolve(MOCK_MASTER_SECRET));

    // Setup crypto.randomUUID mock
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(testDeviceId),
    });

    // Setup storage mocks
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('sessionStorage', mockSessionStorage);

    // Create new service instance for each test
    service = new ShardingService(mockApiService);

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

  describe('getMasterSecret', () => {
    beforeEach(() => {
      // Setup default mocks for this test suite
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'device-share') return testDeviceShare;
        if (key === 'deviceId') return testDeviceId;
        return null;
      });
    });

    it('should throw error if device share is not found', async () => {
      // Override the mock ONLY for this test
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'deviceId') return testDeviceId;
        return null; // Return null for 'device-share'
      });

      await expect(service.getMasterSecret(testAuthData)).rejects.toThrow('Device share not found');
    });

    it('should use cached auth share if available', async () => {
      // Reset localStorage mock to use the default implementation
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'device-share') return testDeviceShare;
        if (key === 'deviceId') return testDeviceId;
        return null;
      });

      mockSessionStorage.getItem.mockReturnValueOnce(testAuthShare);

      const result = await service.getMasterSecret(testAuthData);

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('auth-share');
      expect(mockApiService.getAuthShard).not.toHaveBeenCalled();
      expect(mockCombine).toHaveBeenCalled();
      expect(result).toEqual(MOCK_MASTER_SECRET);
    });

    it('should fetch auth share from API if not cached', async () => {
      // Reset localStorage mock to use the default implementation
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'device-share') return testDeviceShare;
        if (key === 'deviceId') return testDeviceId;
        return null;
      });

      mockSessionStorage.getItem.mockReturnValueOnce(null);
      mockApiService.getAuthShard.mockResolvedValueOnce({
        deviceId: testDeviceId,
        keyShare: testAuthShare,
      });

      const result = await service.getMasterSecret(testAuthData);

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('auth-share');
      expect(mockApiService.getAuthShard).toHaveBeenCalledWith(
        testDeviceId,
        undefined,
        testAuthData
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth-share', testAuthShare);
      expect(mockCombine).toHaveBeenCalled();
      expect(result).toEqual(MOCK_MASTER_SECRET);
    });

    it('should recombine shards and return master secret', async () => {
      // Reset localStorage mock to use the default implementation
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'device-share') return testDeviceShare;
        if (key === 'deviceId') return testDeviceId;
        return null;
      });

      mockSessionStorage.getItem.mockReturnValueOnce(testAuthShare);

      const result = await service.getMasterSecret(testAuthData);

      // Verify the combine function was called with the processed shares
      expect(mockCombine).toHaveBeenCalledWith([expect.any(Uint8Array), expect.any(Uint8Array)]);
      expect(result).toEqual(MOCK_MASTER_SECRET);
    });

    it('should handle errors when combining shares', async () => {
      // Reset localStorage mock to use the default implementation
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'device-share') return testDeviceShare;
        if (key === 'deviceId') return testDeviceId;
        return null;
      });

      mockSessionStorage.getItem.mockReturnValueOnce(testAuthShare);

      // Mock combine to throw an error
      mockCombine.mockRejectedValueOnce(new Error('Test combine error'));

      await expect(service.getMasterSecret(testAuthData)).rejects.toThrow(
        'Failed to recombine key shards: Test combine error'
      );
    });
  });

  describe('base64ToBytes', () => {
    it('should convert base64 to Uint8Array', () => {
      // Reset localStorage mock to use the default implementation
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'device-share') return testDeviceShare;
        if (key === 'deviceId') return testDeviceId;
        return null;
      });

      // Test the private method through its use in getMasterSecret
      mockSessionStorage.getItem.mockReturnValueOnce(testAuthShare);

      service.getMasterSecret(testAuthData);

      // Verify atob was called with the base64 strings
      expect(vi.mocked(atob)).toHaveBeenCalledWith(testDeviceShare);
      expect(vi.mocked(atob)).toHaveBeenCalledWith(testAuthShare);
    });
  });
});
