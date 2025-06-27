import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CrossmintApiService } from './api';
import { CrossmintHttpError, CrossmintRequest } from './request';
import { mock } from 'vitest-mock-extended';
import type { HPKEService } from '../encryption/hpke';
import { z } from 'zod';

const executeSpy = vi.fn().mockResolvedValue({ success: true });

const originalExecute = CrossmintRequest.prototype.execute;
CrossmintRequest.prototype.execute = executeSpy;

describe('CrossmintApiService', () => {
  let apiService: CrossmintApiService;
  let mockHPKEService: HPKEService;

  beforeEach(() => {
    mockHPKEService = mock<HPKEService>();
    apiService = new CrossmintApiService(mockHPKEService);
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
        deviceId,
      };
      executeSpy.mockResolvedValueOnce({ success: true });

      await apiService.startOnboarding(data, authData);

      expect(executeSpy).toHaveBeenCalledWith({
        authId: 'test-auth-id',
        encryptionContext: {
          publicKey: 'test-public-key',
        },
        deviceId,
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

      const result = await apiService.completeOnboarding(data, authData);

      expect(executeSpy).toHaveBeenCalledWith({
        publicKey: 'test-public-key',
        deviceId,
        onboardingAuthentication: { otp: '123456' },
      });
      expect(result).toEqual(mockResponse);
    });
  });
});

describe('CrossmintHttpError e2e', () => {
  let mockHPKEService: HPKEService;

  beforeEach(() => {
    mockHPKEService = mock<HPKEService>();
  });

  it('should throw CrossmintHttpError when request.execute() encounters non-2xx response', async () => {
    const responseBody = { error: 'Resource not found', code: 'NOT_FOUND' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: vi.fn().mockResolvedValue(responseBody),
    });

    const request = new CrossmintRequest({
      inputSchema: z.undefined(),
      outputSchema: z.object({ success: z.boolean() }),
      environment: 'development',
      endpoint: () => '/test-endpoint',
      method: 'GET',
      encryptionService: mockHPKEService,
      getHeaders: () => ({}),
      fetchImpl: mockFetch,
    });

    try {
      await request.execute(undefined);
      expect.fail('Expected request to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CrossmintHttpError);
      expect(error.status).toBe(404);
      expect(error.statusText).toBe('Not Found');
      expect(error.url).toBe('http://localhost:3000/api/v1/signers/test-endpoint');
      expect(error.responseBody).toEqual(responseBody);
      expect(error.name).toBe('CrossmintHttpError');
    }
  });
});
