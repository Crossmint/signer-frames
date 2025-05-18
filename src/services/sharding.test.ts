import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShardingService } from './sharding';
import { createMockServices } from '../tests/test-utils';
import { XMIFCodedError } from './error';

const MOCK_MASTER_SECRET = new Uint8Array(32).fill(1);

const TEST_DEVICE_ID = 'test-device-id';
const TEST_DEVICE_SHARE = 'test-device-share-base64';
const TEST_AUTH_SHARE = 'test-auth-share-base64';
const TEST_AUTH_DATA = {
  jwt: 'test-jwt',
  apiKey: 'test-api-key',
};

// Constants from the sharding service
const DEVICE_SHARE_KEY = 'device-share';
const DEVICE_ID_KEY = 'device-id';

vi.mock('shamir-secret-sharing', () => ({
  combine: vi.fn().mockImplementation(() => Promise.resolve(MOCK_MASTER_SECRET)),
}));

import * as shamir from 'shamir-secret-sharing';
import { subtle } from 'crypto';

const mockCombine = shamir.combine as ReturnType<typeof vi.fn>;

describe('ShardingService', () => {
  const mockServices = createMockServices();

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
    vi.resetAllMocks();

    mockCombine.mockClear();
    mockCombine.mockImplementation(() => Promise.resolve(MOCK_MASTER_SECRET));

    // Create a mock ArrayBuffer that will convert to "h(xyz)" when base64 encoded
    const mockDigestResult = new Uint8Array([104, 40, 120, 121, 122, 41]).buffer;

    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(TEST_DEVICE_ID),
      subtle: { digest: vi.fn().mockResolvedValue(mockDigestResult) },
    });

    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('sessionStorage', mockSessionStorage);

    // Mock the base64 conversion functions
    vi.stubGlobal(
      'atob',
      vi.fn(() => 'ABCD')
    );

    vi.stubGlobal(
      'btoa',
      vi.fn(() => 'h(xyz)')
    );

    service = new ShardingService(mockServices.api);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  // Only keeping essential tests for device identity management
  it('should generate and store a new device ID if none exists', () => {
    mockLocalStorage.getItem.mockReturnValueOnce(null);

    const result = service.getDeviceId();

    expect(crypto.randomUUID).toHaveBeenCalled();
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('device-id', TEST_DEVICE_ID);
    expect(result).toBe(TEST_DEVICE_ID);
  });

  // Keeping the most complex test that covers the core functionality
  describe('getMasterSecret', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'device-share') return TEST_DEVICE_SHARE;
        if (key === 'device-id') return TEST_DEVICE_ID;
        return null;
      });
    });

    it('should handle the complete flow of fetching and combining shares', async () => {
      // Test the case where auth share is not cached
      mockSessionStorage.getItem.mockReturnValueOnce(null);
      mockServices.api.getAuthShard.mockResolvedValueOnce({
        deviceId: TEST_DEVICE_ID,
        keyShare: TEST_AUTH_SHARE,
        deviceKeyShareHash: 'h(xyz)',
      });

      const result = await service.reconstructMasterSecret(TEST_AUTH_DATA);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledWith(
        TEST_DEVICE_ID,
        undefined,
        TEST_AUTH_DATA
      );

      // Verify the shares were combined
      expect(mockCombine).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything(), expect.anything()])
      );
      expect(result).toEqual(MOCK_MASTER_SECRET);
    });

    it('should throw error if device share is not found', async () => {
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'device-id') return TEST_DEVICE_ID;
        return null;
      });

      await expect(service.reconstructMasterSecret(TEST_AUTH_DATA)).rejects.toThrow(
        'Device share not found'
      );
    });

    it('should handle share combination failures', async () => {
      // Mock API response first to avoid destructuring error
      mockServices.api.getAuthShard.mockResolvedValueOnce({
        deviceId: TEST_DEVICE_ID,
        keyShare: TEST_AUTH_SHARE,
        deviceKeyShareHash: 'h(xyz)',
      });

      // Then make combine throw the expected error
      mockCombine.mockRejectedValueOnce(new Error('Failed to combine shares'));

      await expect(service.reconstructMasterSecret(TEST_AUTH_DATA)).rejects.toThrow(
        'Failed to combine shares'
      );
    });

    it('should throw error when device share hash does not match', async () => {
      // Override the btoa mock to return a different hash value
      vi.stubGlobal(
        'btoa',
        vi.fn(() => 'mismatched-hash')
      );

      // Mock API to return a different hash than what our device generates
      mockServices.api.getAuthShard.mockResolvedValue({
        deviceId: TEST_DEVICE_ID,
        keyShare: TEST_AUTH_SHARE,
        deviceKeyShareHash: 'expected-hash', // Different from what btoa returns
      });

      try {
        await service.reconstructMasterSecret(TEST_AUTH_DATA);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(XMIFCodedError);
        expect((error as XMIFCodedError).code).toBe('invalid-device-share');
        expect((error as Error).message).toMatch(/Key share stored on this device does not match/);
      }

      // Verify localStorage items were removed
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(DEVICE_SHARE_KEY);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(DEVICE_ID_KEY);
    });
  });
});
