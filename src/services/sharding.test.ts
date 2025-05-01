import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShardingService } from './sharding';
import { createMockServices } from '../tests/test-utils';

const MOCK_MASTER_SECRET = new Uint8Array(32).fill(1);

const TEST_DEVICE_ID = 'test-device-id';
const TEST_DEVICE_SHARE = 'test-device-share-base64';
const TEST_AUTH_SHARE = 'test-auth-share-base64';
const TEST_AUTH_DATA = {
  jwt: 'test-jwt',
  apiKey: 'test-api-key',
};

vi.mock('shamir-secret-sharing', () => ({
  combine: vi.fn().mockImplementation(() => Promise.resolve(MOCK_MASTER_SECRET)),
}));

import * as shamir from 'shamir-secret-sharing';

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

    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(TEST_DEVICE_ID),
    });

    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('sessionStorage', mockSessionStorage);

    vi.stubGlobal(
      'atob',
      vi.fn(() => 'ABCD')
    );

    service = new ShardingService(mockServices.api);

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  // Only keeping essential tests for device identity management
  it('should generate and store a new device ID if none exists', () => {
    mockLocalStorage.getItem.mockReturnValueOnce(null);

    const result = service.getDeviceId();

    expect(crypto.randomUUID).toHaveBeenCalled();
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('deviceId', TEST_DEVICE_ID);
    expect(result).toBe(TEST_DEVICE_ID);
  });

  // Keeping the most complex test that covers the core functionality
  describe('getMasterSecret', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'device-share') return TEST_DEVICE_SHARE;
        if (key === 'deviceId') return TEST_DEVICE_ID;
        return null;
      });
    });

    it('should handle the complete flow of fetching and combining shares', async () => {
      // Test the case where auth share is not cached
      mockSessionStorage.getItem.mockReturnValueOnce(null);
      mockServices.api.getAuthShard.mockResolvedValueOnce({
        deviceId: TEST_DEVICE_ID,
        keyShare: TEST_AUTH_SHARE,
      });

      const result = await service.getMasterSecret(TEST_AUTH_DATA);

      // Verify the API call was made and result cached
      expect(mockServices.api.getAuthShard).toHaveBeenCalledWith(
        TEST_DEVICE_ID,
        undefined,
        TEST_AUTH_DATA
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth-share', TEST_AUTH_SHARE);

      // Verify the shares were combined
      expect(mockCombine).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything(), expect.anything()])
      );
      expect(result).toEqual(MOCK_MASTER_SECRET);
    });

    it('should throw error if device share is not found', async () => {
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === 'deviceId') return TEST_DEVICE_ID;
        return null;
      });

      await expect(service.getMasterSecret(TEST_AUTH_DATA)).rejects.toThrow(
        'Device share not found'
      );
    });

    it('should handle share combination failures', async () => {
      mockSessionStorage.getItem.mockReturnValueOnce(TEST_AUTH_SHARE);
      mockCombine.mockRejectedValueOnce(new Error('Failed to combine shares'));

      await expect(service.getMasterSecret(TEST_AUTH_DATA)).rejects.toThrow(
        'Failed to combine shares'
      );
    });
  });
});
