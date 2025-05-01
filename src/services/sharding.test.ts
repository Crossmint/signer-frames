import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShardingService } from './sharding';
import { createMockServices } from '../tests/test-utils';
import { mock } from 'vitest-mock-extended';

// Create a reusable mock value for the master secret
const MOCK_MASTER_SECRET = new Uint8Array(32).fill(1);

// Define constants for test data
const TEST_DEVICE_ID = 'test-device-id';
const TEST_DEVICE_SHARE = 'test-device-share-base64';
const TEST_AUTH_SHARE = 'test-auth-share-base64';
const TEST_AUTH_DATA = {
  jwt: 'test-jwt',
  apiKey: 'test-api-key',
};

// Define mocks FIRST before importing any modules that use them
vi.mock('shamir-secret-sharing', () => ({
  combine: vi.fn().mockImplementation(() => Promise.resolve(MOCK_MASTER_SECRET)),
}));

// Now import shamir after mocking
import * as shamir from 'shamir-secret-sharing';

// Make mocked combine function available
const mockCombine = shamir.combine as ReturnType<typeof vi.fn>;

describe('ShardingService', () => {
  // Get a clean set of mocked services for each test
  const mockServices = createMockServices();

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

  let service: ShardingService;

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Make sure the combine mock returns a promise with the expected value
    mockCombine.mockClear();
    mockCombine.mockImplementation(() => Promise.resolve(MOCK_MASTER_SECRET));

    // Setup crypto.randomUUID mock
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(TEST_DEVICE_ID),
    });

    // Setup storage mocks
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('sessionStorage', mockSessionStorage);

    // Setup base64 decoding mock
    vi.stubGlobal(
      'atob',
      vi.fn(() => {
        // Simple mock implementation of atob
        return 'ABCD';
      })
    );

    // Create new service instance for each test
    service = new ShardingService(mockServices.api);

    // Mock console.log to avoid clutter in test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('getDeviceId', () => {
    it('should return existing device ID from localStorage if available', () => {
      // Arrange
      mockLocalStorage.getItem.mockReturnValueOnce(TEST_DEVICE_ID);

      // Act
      const result = service.getDeviceId();

      // Assert
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('deviceId');
      expect(result).toBe(TEST_DEVICE_ID);
    });

    it('should generate a new device ID if none exists in localStorage', () => {
      // Arrange
      mockLocalStorage.getItem.mockReturnValueOnce(null);

      // Act
      const result = service.getDeviceId();

      // Assert
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('deviceId');
      expect(crypto.randomUUID).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('deviceId', TEST_DEVICE_ID);
      expect(result).toBe(TEST_DEVICE_ID);
    });
  });

  describe('storeDeviceShare and getDeviceShare', () => {
    it('should store device share in localStorage', () => {
      // Act
      service.storeDeviceShare(TEST_DEVICE_SHARE);

      // Assert
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('device-share', TEST_DEVICE_SHARE);
    });

    it('should retrieve device share from localStorage', () => {
      // Arrange
      mockLocalStorage.getItem.mockReturnValueOnce(TEST_DEVICE_SHARE);

      // Act
      const result = service.getDeviceShare();

      // Assert
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('device-share');
      expect(result).toBe(TEST_DEVICE_SHARE);
    });
  });

  describe('cacheAuthShare and getCachedAuthShare', () => {
    it('should store auth share in sessionStorage', () => {
      // Act
      service.cacheAuthShare(TEST_AUTH_SHARE);

      // Assert
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth-share', TEST_AUTH_SHARE);
    });

    it('should retrieve auth share from sessionStorage', () => {
      // Arrange
      mockSessionStorage.getItem.mockReturnValueOnce(TEST_AUTH_SHARE);

      // Act
      const result = service.getCachedAuthShare();

      // Assert
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('auth-share');
      expect(result).toBe(TEST_AUTH_SHARE);
    });
  });

  describe('getMasterSecret', () => {
    beforeEach(() => {
      // Setup default mocks for this test suite
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'device-share') return TEST_DEVICE_SHARE;
        if (key === 'deviceId') return TEST_DEVICE_ID;
        return null;
      });
    });

    it('should throw error if device share is not found', async () => {
      // Arrange: Override the mock to simulate missing device share
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'deviceId') return TEST_DEVICE_ID;
        return null; // Return null for 'device-share'
      });

      // Act & Assert
      await expect(service.getMasterSecret(TEST_AUTH_DATA)).rejects.toThrow(
        'Device share not found'
      );
    });

    it('should use cached auth share if available', async () => {
      // Arrange
      mockSessionStorage.getItem.mockReturnValueOnce(TEST_AUTH_SHARE);

      // Act
      const result = await service.getMasterSecret(TEST_AUTH_DATA);

      // Assert
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('auth-share');
      expect(mockServices.api.getAuthShard).not.toHaveBeenCalled();
      expect(mockCombine).toHaveBeenCalled();
      expect(result).toEqual(MOCK_MASTER_SECRET);
    });

    it('should fetch auth share from API if not cached', async () => {
      // Arrange
      mockSessionStorage.getItem.mockReturnValueOnce(null);
      mockServices.api.getAuthShard.mockResolvedValueOnce({
        deviceId: TEST_DEVICE_ID,
        keyShare: TEST_AUTH_SHARE,
      });

      // Act
      const result = await service.getMasterSecret(TEST_AUTH_DATA);

      // Assert
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('auth-share');
      expect(mockServices.api.getAuthShard).toHaveBeenCalledWith(
        TEST_DEVICE_ID,
        undefined,
        TEST_AUTH_DATA
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth-share', TEST_AUTH_SHARE);
      expect(mockCombine).toHaveBeenCalled();
      expect(result).toEqual(MOCK_MASTER_SECRET);
    });

    it('should recombine shards and return master secret', async () => {
      mockSessionStorage.getItem.mockReturnValueOnce(TEST_AUTH_SHARE);

      const result = await service.getMasterSecret(TEST_AUTH_DATA);

      expect(mockCombine).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything(), expect.anything()])
      );
      expect(result).toEqual(MOCK_MASTER_SECRET);
    });

    it('should throw error if device share cannot be decoded', async () => {
      mockSessionStorage.getItem.mockReturnValueOnce(TEST_AUTH_SHARE);
      mockCombine.mockRejectedValueOnce(new Error('Failed to combine shares'));

      await expect(service.getMasterSecret(TEST_AUTH_DATA)).rejects.toThrow(
        'Failed to combine shares'
      );
    });
  });

  describe('base64ToBytes', () => {
    it('should convert base64 to Uint8Array', () => {
      // Arrange: Setup mock for atob to return predictable results
      const mockBtoa = vi.fn().mockReturnValue('ABCD');
      vi.stubGlobal('atob', mockBtoa);

      // Act: Call the private method via any cast for testing
      const result = (service as any).base64ToBytes('testBase64String');

      // Assert
      expect(mockBtoa).toHaveBeenCalledWith('testBase64String');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(4); // 'ABCD' has 4 characters
    });
  });
});
