import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CrossmintApiService, parseApiKey } from './api';
import { mock } from 'vitest-mock-extended';
import type { EncryptionService } from './encryption';
import { CrossmintRequest } from './request';

const executeSpy = vi.fn().mockResolvedValue({ success: true });

const originalExecute = CrossmintRequest.prototype.execute;
CrossmintRequest.prototype.execute = executeSpy;

describe('CrossmintApiService', () => {
  let apiService: CrossmintApiService;
  let mockEncryptionService: EncryptionService;

  beforeEach(() => {
    mockEncryptionService = mock<EncryptionService>();
    apiService = new CrossmintApiService(mockEncryptionService);
    executeSpy.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(() => {
    CrossmintRequest.prototype.execute = originalExecute;
  });

  describe('API methods', () => {
    const deviceId = 'test-device-id';
    const authData = { jwt: 'test-jwt', apiKey: 'sk_development_test' };

    it('should properly call startOnboarding with correct parameters', async () => {
      const data = {
        authId: 'test-auth-id',
        encryptionContext: {
          publicKey: 'test-public-key',
        },
      };
      executeSpy.mockResolvedValueOnce({ success: true });

      await apiService.startOnboarding(deviceId, data, authData);

      expect(executeSpy).toHaveBeenCalledWith({
        authId: 'test-auth-id',
        encryptionContext: {
          publicKey: 'test-public-key',
        },
      });
    });

    it('should properly call completeOnboarding with correct parameters and return shares', async () => {
      const data = {
        publicKey: 'test-public-key',
        deviceId,
        onboardingAuthentication: { otp: '123456' },
      };
      const mockResponse = { shares: { device: 'device-share', auth: 'auth-share' } };
      executeSpy.mockResolvedValueOnce(mockResponse);

      const result = await apiService.completeOnboarding(deviceId, data, authData);

      expect(executeSpy).toHaveBeenCalledWith({
        publicKey: 'test-public-key',
        deviceId,
        onboardingAuthentication: { otp: '123456' },
      });
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
