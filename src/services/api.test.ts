import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CrossmintApiService, parseApiKey } from './api';
import { createMockResponse } from '../tests/test-utils';
import { mock } from 'vitest-mock-extended';
import type { EncryptionService } from './encryption';
import { CrossmintRequest } from './request';

// Create a spy for the execute method
const executeSpy = vi.fn().mockResolvedValue({ success: true });

// Mock the CrossmintRequest class by replacing its prototype.execute method
const originalExecute = CrossmintRequest.prototype.execute;
CrossmintRequest.prototype.execute = executeSpy;

// Create a mock ApiKeyService interface
interface ApiKeyService {
  getBaseUrl(apiKey: string): string;
}

// Create a mock ApiKeyService class
class MockApiKeyService implements ApiKeyService {
  getBaseUrl(apiKey: string): string {
    if (apiKey === 'sk_development_123') {
      return 'http://localhost:3000/api/unstable/wallets/ncs';
    }

    if (apiKey === 'sk_staging_123') {
      return 'https://staging.crossmint.com/api/unstable/wallets/ncs';
    }

    if (apiKey === 'sk_production_123') {
      return 'https://crossmint.com/api/unstable/wallets/ncs';
    }

    if (apiKey === 'sk_invalid123') {
      throw new Error('Invalid API key');
    }

    return 'https://crossmint.com/api/unstable/wallets/ncs'; // Default fallback
  }
}

describe('CrossmintApiService', () => {
  let apiService: CrossmintApiService;
  let mockEncryptionService: EncryptionService;

  beforeEach(() => {
    // Setup clean mocks for each test
    mockEncryptionService = mock<EncryptionService>();

    // Create with the correctly typed MockApiKeyService
    apiService = new CrossmintApiService(mockEncryptionService, new MockApiKeyService());

    // Reset mock state
    executeSpy.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Reset the CrossmintRequest.prototype.execute after all tests
  afterAll(() => {
    CrossmintRequest.prototype.execute = originalExecute;
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      await expect(apiService.init()).resolves.not.toThrow();
    });
  });

  describe('getBaseUrl', () => {
    it('should generate correct URL for development environment', () => {
      const result = apiService.getBaseUrl('sk_development_123');
      expect(result).toBe('http://localhost:3000/api/unstable/wallets/ncs');
    });

    it('should generate correct URL for staging environment', () => {
      const result = apiService.getBaseUrl('sk_staging_123');
      expect(result).toBe('https://staging.crossmint.com/api/unstable/wallets/ncs');
    });

    it('should generate correct URL for production environment', () => {
      const result = apiService.getBaseUrl('sk_production_123');
      expect(result).toBe('https://crossmint.com/api/unstable/wallets/ncs');
    });

    it('should throw error for invalid environment', () => {
      expect(() => apiService.getBaseUrl('sk_invalid123')).toThrow('Invalid API key');
    });
  });

  describe('API methods', () => {
    const deviceId = 'test-device-id';
    const authData = { jwt: 'test-jwt', apiKey: 'test-api-key' };

    describe('createSigner', () => {
      it('should make request with correct parameters', async () => {
        const data = { authId: 'test-auth-id', chainLayer: 'solana' };
        executeSpy.mockResolvedValueOnce({ success: true });

        await apiService.createSigner(deviceId, data, authData);

        expect(executeSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            authId: 'test-auth-id',
            chainLayer: 'solana',
          }),
          authData
        );
      });
    });

    describe('sendOtp', () => {
      it('should make request with correct parameters', async () => {
        const data = { otp: '123456' };
        const mockResponse = { shares: { device: 'device-share', auth: 'auth-share' } };
        executeSpy.mockResolvedValueOnce(mockResponse);

        const result = await apiService.sendOtp(deviceId, data, authData);

        expect(executeSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            otp: '123456',
          }),
          authData
        );
        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('parseApiKey function', () => {
    it('should correctly parse server-side API keys with different environments', () => {
      const testCases = [
        { key: 'sk_development_123', expected: { origin: 'server', environment: 'development' } },
        { key: 'sk_staging_123', expected: { origin: 'server', environment: 'staging' } },
        { key: 'sk_production_123', expected: { origin: 'server', environment: 'production' } },
      ];

      for (const { key, expected } of testCases) {
        expect(parseApiKey(key)).toEqual(expected);
      }
    });

    it('should correctly parse client-side API keys', () => {
      expect(parseApiKey('ck_production_123')).toEqual({
        origin: 'client',
        environment: 'production',
      });
    });

    it('should throw error for invalid API key', () => {
      expect(() => parseApiKey('invalid123')).toThrow('Invalid API key');
    });
  });
});
