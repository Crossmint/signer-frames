import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import * as apiModule from './api';
import { CrossmintApiService } from './api';
import type { EncryptionService } from './encryption';
import { mock } from 'vitest-mock-extended';

// Mock the CrossmintRequest class
const mockExecute = vi.fn().mockResolvedValue({ success: true });
vi.mock('./request', () => {
  return {
    CrossmintRequest: vi.fn().mockImplementation(() => {
      return {
        execute: mockExecute,
      };
    }),
  };
});

describe('CrossmintApiService', () => {
  let apiService: CrossmintApiService;

  // Create a spy on parseApiKey
  const parseApiKeySpy = vi.spyOn(apiModule, 'parseApiKey');

  beforeEach(() => {
    const mockEncryptionService = mock<EncryptionService>();
    apiService = new CrossmintApiService(mockEncryptionService);
    mockExecute.mockClear();
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
});
