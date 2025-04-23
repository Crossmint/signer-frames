import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import { CrossmintApiService } from './api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CrossmintApiService', () => {
  let apiService: CrossmintApiService;
  const testUrl = 'http://test-api.com';
  const testDeviceId = 'test-device-id';
  const testAuthData = {
    jwt: 'test-jwt',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    apiService = new CrossmintApiService(testUrl);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(apiService).toBeDefined();
  });

  it('should initialize without errors', async () => {
    await expect(apiService.init()).resolves.not.toThrow();
  });

  it('should use the provided base URL', async () => {
    const urlService = new CrossmintApiService('https://custom-url.com');
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });

    await urlService.getAuthShard(testDeviceId, testAuthData);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom-url.com/api/unstable/wallets/ncs/test-device-id',
      expect.objectContaining({
        headers: expect.any(Object),
      })
    );
  });

  it('should include correct headers in the request', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });

    await apiService.getAuthShard(testDeviceId, testAuthData);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testAuthData.jwt}`,
          'x-api-key': testAuthData.apiKey,
        },
      })
    );
  });

  describe('createSigner', () => {
    it('should make a POST request to create a signer', async () => {
      const testData = { authId: 'test-auth-id' };
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ success: true }),
      });

      await apiService.createSigner(testDeviceId, testAuthData, testData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${testUrl}/api/unstable/wallets/ncs/${testDeviceId}`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(testData),
          headers: expect.any(Object),
        })
      );
    });
  });

  describe('sendOtp', () => {
    it('should make a POST request to send OTP and return expected data', async () => {
      const testOtpData = { otp: '123456' };
      const expectedResponse = {
        shares: {
          device: 'device-shard',
          auth: 'auth-shard',
        },
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => expectedResponse,
      });

      const result = await apiService.sendOtp(testDeviceId, testAuthData, testOtpData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${testUrl}/api/unstable/wallets/ncs/${testDeviceId}/auth`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(testOtpData),
          headers: expect.any(Object),
        })
      );

      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getAuthShard', () => {
    it('should make a GET request to fetch auth shard and return expected data', async () => {
      const expectedResponse = {
        deviceId: testDeviceId,
        keyShare: 'test-key-share',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => expectedResponse,
      });

      const result = await apiService.getAuthShard(testDeviceId, testAuthData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${testUrl}/api/unstable/wallets/ncs/${testDeviceId}`,
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );

      expect(result).toEqual(expectedResponse);
    });
  });
});
