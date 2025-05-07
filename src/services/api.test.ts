import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CrossmintApiService, parseApiKey } from './api';
import { mock } from 'vitest-mock-extended';
import type { EncryptionService } from './encryption';
import { CrossmintRequest } from './request';

const executeSpy = vi.fn().mockResolvedValue({ success: true });

const originalExecute = CrossmintRequest.prototype.execute;
CrossmintRequest.prototype.execute = executeSpy;

interface ApiKeyService {
  getBaseUrl(apiKey: string): string;
}

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
    return 'https://crossmint.com/api/unstable/wallets/ncs';
  }
}

describe('CrossmintApiService', () => {
  let apiService: CrossmintApiService;
  let mockEncryptionService: EncryptionService;

  beforeEach(() => {
    mockEncryptionService = mock<EncryptionService>();
    apiService = new CrossmintApiService(mockEncryptionService, new MockApiKeyService());
    executeSpy.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(() => {
    CrossmintRequest.prototype.execute = originalExecute;
  });

  describe('getBaseUrl', () => {
    it('should generate correct URLs for different environments', () => {
      expect(apiService.getBaseUrl('sk_development_123')).toBe(
        'http://localhost:3000/api/unstable/wallets/ncs'
      );
      expect(apiService.getBaseUrl('sk_staging_123')).toBe(
        'https://staging.crossmint.com/api/unstable/wallets/ncs'
      );
      expect(apiService.getBaseUrl('sk_production_123')).toBe(
        'https://crossmint.com/api/unstable/wallets/ncs'
      );
      expect(() => apiService.getBaseUrl('sk_invalid123')).toThrow('Invalid API key');
    });
  });

  describe('API methods', () => {
    const deviceId = 'test-device-id';
    const authData = { jwt: 'test-jwt', apiKey: 'test-api-key' };

    it('should properly call createSigner with correct parameters', async () => {
      const data = {
        authId: 'test-auth-id',
        chainLayer: 'solana',
        encryptionContext: {
          publicKey: 'test-public-key',
        },
      };
      executeSpy.mockResolvedValueOnce({ success: true });

      await apiService.createSigner(deviceId, data, authData);

      expect(executeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          authId: 'test-auth-id',
          chainLayer: 'solana',
          encryptionContext: {
            publicKey: 'test-public-key',
          },
        }),
        authData
      );
    });

    it('should properly call sendOtp with correct parameters and return shares', async () => {
      const data = { otp: '123456', publicKey: 'test-public-key' };
      const mockResponse = { shares: { device: 'device-share', auth: 'auth-share' } };
      executeSpy.mockResolvedValueOnce(mockResponse);

      const result = await apiService.sendOtp(deviceId, data, authData);

      expect(executeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ otp: '123456', publicKey: 'test-public-key' }),
        authData
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('parseApiKey function', () => {
    it('should correctly parse different types of API keys', () => {
      // Server-side keys
      expect(parseApiKey('sk_development_123')).toEqual({
        origin: 'server',
        environment: 'development',
      });
      expect(parseApiKey('sk_staging_123')).toEqual({ origin: 'server', environment: 'staging' });
      expect(parseApiKey('sk_production_123')).toEqual({
        origin: 'server',
        environment: 'production',
      });

      // Client-side keys
      expect(parseApiKey('ck_production_123')).toEqual({
        origin: 'client',
        environment: 'production',
      });

      // Invalid keys
      expect(() => parseApiKey('invalid123')).toThrow('Invalid API key');
    });
  });
});
