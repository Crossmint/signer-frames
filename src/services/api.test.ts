import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import * as apiModule from './api';
import { CrossmintApiService } from './api';

// Test subclass to access protected methods
class TestCrossmintApiService extends CrossmintApiService {
  public async testFetchWithRetry(url: string, options: RequestInit, retryCount = 0) {
    return this.fetchWithRetry(url, options, retryCount);
  }
}

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CrossmintApiService', () => {
  let apiService: CrossmintApiService;
  let testApiService: TestCrossmintApiService;
  const testDeviceId = 'test-device-id';
  const testAuthData = {
    jwt: 'test-jwt',
    apiKey: 'sk_development_123',
  };

  // Create a spy on parseApiKey
  const parseApiKeySpy = vi.spyOn(apiModule, 'parseApiKey');

  beforeEach(() => {
    apiService = new CrossmintApiService();
    testApiService = new TestCrossmintApiService();
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

  describe('fetchWithRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry on 429 status with exponential backoff', async () => {
      const fetchMock = vi.fn();
      // First attempt returns 429, second attempt returns 200
      fetchMock
        .mockResolvedValueOnce({
          status: 429,
          headers: {
            get: vi.fn().mockReturnValue('1'), // 1 second retry
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          json: vi.fn().mockResolvedValue({ success: true }),
          headers: {
            get: vi.fn(),
          },
        });

      global.fetch = fetchMock;

      const promise = testApiService.testFetchWithRetry('https://test.com', { method: 'GET' });

      // Fast-forward past the retry delay (1000ms)
      await vi.advanceTimersByTimeAsync(1100);

      const response = await promise;
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should retry on network errors', async () => {
      const fetchMock = vi.fn();
      // First attempt throws error, second attempt returns 200
      fetchMock.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
        headers: {
          get: vi.fn(),
        },
      });

      global.fetch = fetchMock;

      const promise = testApiService.testFetchWithRetry('https://test.com', { method: 'GET' });

      // Fast-forward past the retry delay
      await vi.advanceTimersByTimeAsync(1100);

      const response = await promise;
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should respect max retries and eventually fail', async () => {
      const fetchMock = vi.fn();
      // All attempts return 429
      fetchMock.mockResolvedValue({
        status: 429,
        headers: {
          get: vi.fn().mockReturnValue('1'),
        },
      });

      global.fetch = fetchMock;

      // Create service with custom retry config (2 max retries)
      testApiService = new TestCrossmintApiService({ maxRetries: 2 });
      const promise = testApiService.testFetchWithRetry('https://test.com', { method: 'GET' });

      // Fast-forward past all retry delays
      await vi.advanceTimersByTimeAsync(1100);
      await vi.advanceTimersByTimeAsync(2200);
      await vi.advanceTimersByTimeAsync(4400);

      const response = await promise;
      expect(response.status).toBe(429);
      expect(fetchMock).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});
