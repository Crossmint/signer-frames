import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import * as apiModule from './api';
import { CrossmintApiService } from './api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CrossmintApiService', () => {
  let apiService: CrossmintApiService;
  const testDeviceId = 'test-device-id';
  const testAuthData = {
    jwt: 'test-jwt',
    apiKey: 'sk_development_123',
  };

  // Create a spy on parseApiKey
  const parseApiKeySpy = vi.spyOn(apiModule, 'parseApiKey');

  beforeEach(() => {
    apiService = new CrossmintApiService();
    mockFetch.mockClear();
    parseApiKeySpy.mockClear();
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

  describe('getBaseUrl', () => {
    it('should generate correct URL for development environment', () => {
      parseApiKeySpy.mockReturnValueOnce({
        origin: 'server',
        environment: 'development',
      });

      const result = apiService.getBaseUrl('sk_development_123');

      expect(result).toBe('http://localhost:3000/api/unstable/wallets/ncs');
    });

    it('should generate correct URL for staging environment', () => {
      parseApiKeySpy.mockReturnValueOnce({
        origin: 'server',
        environment: 'staging',
      });

      const result = apiService.getBaseUrl('sk_staging_123');

      expect(result).toBe('https://staging.crossmint.com/api/unstable/wallets/ncs');
    });

    it('should generate correct URL for production environment', () => {
      parseApiKeySpy.mockReturnValueOnce({
        origin: 'server',
        environment: 'production',
      });

      const result = apiService.getBaseUrl('sk_production_123');

      expect(result).toBe('https://crossmint.com/api/unstable/wallets/ncs');
    });

    it('should throw error for invalid environment', () => {
      parseApiKeySpy.mockImplementationOnce(() => {
        throw new Error('Invalid API key');
      });

      expect(() => apiService.getBaseUrl('sk_invalid123')).toThrow('Invalid API key');
    });
  });

  describe('parseApiKey function', () => {
    beforeEach(() => {
      parseApiKeySpy.mockRestore();
    });

    it('should correctly parse server-side development API key', () => {
      const result = apiModule.parseApiKey('sk_development_123');
      expect(result).toEqual({
        origin: 'server',
        environment: 'development',
      });
    });

    it('should correctly parse server-side staging API key', () => {
      const result = apiModule.parseApiKey('sk_staging_123');
      expect(result).toEqual({
        origin: 'server',
        environment: 'staging',
      });
    });

    it('should correctly parse server-side production API key', () => {
      const result = apiModule.parseApiKey('sk_production_123');
      expect(result).toEqual({
        origin: 'server',
        environment: 'production',
      });
    });

    it('should correctly parse client-side API keys', () => {
      const result = apiModule.parseApiKey('ck_production_123');
      expect(result).toEqual({
        origin: 'client',
        environment: 'production',
      });
    });

    it('should throw error for invalid API key', () => {
      expect(() => apiModule.parseApiKey('skinvalid123')).toThrow('Invalid API key');
    });
  });

  it('should include correct headers in the request', async () => {
    parseApiKeySpy.mockReturnValue({
      origin: 'server',
      environment: 'production',
    });

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
      parseApiKeySpy.mockReturnValue({
        origin: 'server',
        environment: 'production',
      });

      const testData = { authId: 'test-auth-id' };
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ success: true }),
      });

      await apiService.createSigner(testDeviceId, testAuthData, testData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${apiService.getBaseUrl(testAuthData.apiKey)}/${testDeviceId}`,
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
      parseApiKeySpy.mockReturnValue({
        origin: 'server',
        environment: 'production',
      });

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
        `${apiService.getBaseUrl(testAuthData.apiKey)}/${testDeviceId}/auth`,
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
      parseApiKeySpy.mockReturnValue({
        origin: 'server',
        environment: 'production',
      });

      const expectedResponse = {
        deviceId: testDeviceId,
        keyShare: 'test-key-share',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => expectedResponse,
      });

      const result = await apiService.getAuthShard(testDeviceId, testAuthData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${apiService.getBaseUrl(testAuthData.apiKey)}/${testDeviceId}/key-shares`,
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );

      expect(result).toEqual(expectedResponse);
    });
  });
});
