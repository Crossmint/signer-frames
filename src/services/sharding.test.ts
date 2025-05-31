/**
 * SECURITY CRITICAL: ShardingService Test Suite
 *
 * This service handles Shamir Secret Sharing for cryptographic keys.
 * Security properties tested:
 * 1. Device ID isolation and generation
 * 2. Master secret reconstruction from auth + device shares
 * 3. Device share integrity validation via hash consistency
 * 4. Multi-signer isolation (no cross-contamination between signers)
 * 5. Secure cleanup on integrity failures
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { ShardingService } from './sharding';
import type { AuthShareCache } from './auth-share-cache';
import { XMIFCodedError } from './error';

// Test constants
const MOCK_MASTER_SECRET = new Uint8Array(32).fill(1);
const TEST_DEVICE_ID = 'test-device-id';
const TEST_DEVICE_SHARE = 'test-device-share-base64';
const TEST_SIGNER_ID = 'test-signer-id';
const TEST_AUTH_DATA = { jwt: 'test-jwt', apiKey: 'test-api-key' };

// Storage keys from the service
const DEVICE_SHARE_KEY = 'device-share';

// Mock Shamir secret sharing
vi.mock('shamir-secret-sharing', () => ({
  combine: vi.fn().mockImplementation(() => Promise.resolve(MOCK_MASTER_SECRET)),
}));

import * as shamir from 'shamir-secret-sharing';
import type { DeviceService } from './device';
const mockCombine = shamir.combine as ReturnType<typeof vi.fn>;

describe('ShardingService - Security Critical Tests', () => {
  let service: ShardingService;
  let mockAuthShareCache: MockProxy<AuthShareCache>;
  let mockDeviceService: MockProxy<DeviceService>;
  let mockLocalStorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    key: ReturnType<typeof vi.fn>;
    length: number;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCombine.mockClear().mockImplementation(() => Promise.resolve(MOCK_MASTER_SECRET));

    // Mock browser APIs
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };

    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(TEST_DEVICE_ID),
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array([104, 40, 120, 121, 122, 41]).buffer),
      },
    });

    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal(
      'atob',
      vi.fn(() => 'ABCD')
    );
    vi.stubGlobal(
      'btoa',
      vi.fn(() => 'h(xyz)')
    );

    // Mock dependencies
    mockAuthShareCache = mock<AuthShareCache>();
    mockDeviceService = mock<import('./device').DeviceService>();
    mockDeviceService.getId.mockReturnValue(TEST_DEVICE_ID);

    service = new ShardingService(mockAuthShareCache, mockDeviceService);

    // Suppress console output in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  describe('Master Secret Reconstruction - Core Security Function', () => {
    beforeEach(() => {
      // Default setup: valid device share exists
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === `${DEVICE_SHARE_KEY}-${TEST_SIGNER_ID}`) return TEST_DEVICE_SHARE;
        return null;
      });
    });

    it('SECURITY: Should successfully reconstruct master secret from valid shares', async () => {
      // SECURITY PROPERTY: Valid auth + device shares = master secret
      mockAuthShareCache.getAuthShare.mockResolvedValueOnce({
        authKeyShare: 'test-auth-share',
        deviceKeyShareHash: 'h(xyz)', // Matches our btoa mock
        signerId: TEST_SIGNER_ID,
      });

      const result = await service.reconstructMasterSecret(TEST_AUTH_DATA);

      expect(mockAuthShareCache.getAuthShare).toHaveBeenCalledWith(TEST_DEVICE_ID, TEST_AUTH_DATA);
      expect(mockCombine).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything(), expect.anything()])
      );
      expect(result).toEqual(MOCK_MASTER_SECRET);
    });

    it('SECURITY: Should fail safely when auth share is unavailable', async () => {
      // SECURITY PROPERTY: Missing auth share = no secret reconstruction
      mockAuthShareCache.getAuthShare.mockResolvedValueOnce(null);

      const result = await service.reconstructMasterSecret(TEST_AUTH_DATA);

      expect(result).toBeNull();
      expect(mockCombine).not.toHaveBeenCalled();
    });

    it('SECURITY: Should fail safely when device share is missing', async () => {
      // SECURITY PROPERTY: Missing device share = no secret reconstruction
      mockAuthShareCache.getAuthShare.mockResolvedValueOnce({
        authKeyShare: 'test-auth-share',
        deviceKeyShareHash: 'h(xyz)',
        signerId: TEST_SIGNER_ID,
      });

      mockLocalStorage.getItem.mockImplementation(key => {
        return null; // No device share
      });

      const result = await service.reconstructMasterSecret(TEST_AUTH_DATA);

      expect(result).toBeNull();
      expect(mockCombine).not.toHaveBeenCalled();
    });

    it('SECURITY: Should handle cryptographic failures gracefully', async () => {
      // SECURITY PROPERTY: Shamir reconstruction errors are properly handled
      mockAuthShareCache.getAuthShare.mockResolvedValueOnce({
        authKeyShare: 'test-auth-share',
        deviceKeyShareHash: 'h(xyz)',
        signerId: TEST_SIGNER_ID,
      });

      mockCombine.mockRejectedValueOnce(new Error('Invalid share format'));

      await expect(service.reconstructMasterSecret(TEST_AUTH_DATA)).rejects.toThrow(
        'Failed to recombine key shards: Invalid share format'
      );
    });
  });

  describe('Device Share Integrity Validation - Tampering Detection', () => {
    it('SECURITY: Should detect and respond to device share tampering', async () => {
      // SECURITY PROPERTY: Hash mismatch = potential tampering = secure cleanup
      vi.stubGlobal(
        'btoa',
        vi.fn(() => 'tampered-hash')
      );

      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === `${DEVICE_SHARE_KEY}-${TEST_SIGNER_ID}`) return TEST_DEVICE_SHARE;
        return null;
      });

      mockAuthShareCache.getAuthShare.mockResolvedValueOnce({
        authKeyShare: 'test-auth-share',
        deviceKeyShareHash: 'expected-hash', // Different from tampered-hash
        signerId: TEST_SIGNER_ID,
      });

      await expect(service.reconstructMasterSecret(TEST_AUTH_DATA)).rejects.toThrow(XMIFCodedError);

      // SECURITY CRITICAL: Verify complete cleanup on tampering detection
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${TEST_SIGNER_ID}`
      );
      expect(mockDeviceService.clearId).toHaveBeenCalled();
      expect(mockAuthShareCache.clearCache).toHaveBeenCalled();
    });
  });

  describe('Device Share Storage', () => {
    it('Should store device share with correct signer isolation', () => {
      // SECURITY PROPERTY: Each signer gets isolated storage
      service.storeDeviceShare(TEST_SIGNER_ID, TEST_DEVICE_SHARE);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${TEST_SIGNER_ID}`,
        TEST_DEVICE_SHARE
      );
    });
  });

  describe('Multi-Signer Isolation - Cross-Contamination Prevention', () => {
    // SECURITY CRITICAL: These tests verify that multiple signers cannot access each other's data

    const SIGNER_SCENARIOS = {
      signer1: {
        authData: { jwt: 'signer1-jwt', apiKey: 'signer1-api-key' },
        signerId: 'signer-1',
        deviceShare: 'device-share-1-base64',
        authShare: 'auth-share-1-base64',
      },
      signer2: {
        authData: { jwt: 'signer2-jwt', apiKey: 'signer2-api-key' },
        signerId: 'signer-2',
        deviceShare: 'device-share-2-base64',
        authShare: 'auth-share-2-base64',
      },
      signer3: {
        authData: { jwt: 'signer3-jwt', apiKey: 'signer1-api-key' }, // Same API, different JWT
        signerId: 'signer-3',
        deviceShare: 'device-share-3-base64',
        authShare: 'auth-share-3-base64',
      },
    };

    beforeEach(() => {
      // Setup isolated storage for each signer
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer1.signerId}`)
          return SIGNER_SCENARIOS.signer1.deviceShare;
        if (key === `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer2.signerId}`)
          return SIGNER_SCENARIOS.signer2.deviceShare;
        if (key === `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer3.signerId}`)
          return SIGNER_SCENARIOS.signer3.deviceShare;
        return null;
      });

      // Setup isolated auth share responses
      mockAuthShareCache.getAuthShare.mockImplementation(async (deviceId, authData) => {
        const scenario = Object.values(SIGNER_SCENARIOS).find(
          s => s.authData.jwt === authData.jwt && s.authData.apiKey === authData.apiKey
        );

        if (scenario) {
          return {
            authKeyShare: scenario.authShare,
            deviceKeyShareHash: 'h(xyz)',
            signerId: scenario.signerId,
          };
        }

        throw new Error(`Unexpected auth data: ${JSON.stringify(authData)}`);
      });
    });

    it('SECURITY: Should maintain complete isolation between multiple signers', async () => {
      // SECURITY PROPERTY: Each signer can only access their own data

      // Test all signers can reconstruct independently
      const results = await Promise.all([
        service.reconstructMasterSecret(SIGNER_SCENARIOS.signer1.authData),
        service.reconstructMasterSecret(SIGNER_SCENARIOS.signer2.authData),
        service.reconstructMasterSecret(SIGNER_SCENARIOS.signer3.authData),
      ]);

      // All should succeed with same result (in real use, would be different keys)
      for (const result of results) {
        expect(result).toEqual(MOCK_MASTER_SECRET);
      }

      // Verify correct isolation: each signer's auth data called exactly once
      expect(mockAuthShareCache.getAuthShare).toHaveBeenCalledTimes(3);
      expect(mockAuthShareCache.getAuthShare).toHaveBeenCalledWith(
        TEST_DEVICE_ID,
        SIGNER_SCENARIOS.signer1.authData
      );
      expect(mockAuthShareCache.getAuthShare).toHaveBeenCalledWith(
        TEST_DEVICE_ID,
        SIGNER_SCENARIOS.signer2.authData
      );
      expect(mockAuthShareCache.getAuthShare).toHaveBeenCalledWith(
        TEST_DEVICE_ID,
        SIGNER_SCENARIOS.signer3.authData
      );

      // Verify correct device share isolation
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer1.signerId}`
      );
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer2.signerId}`
      );
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer3.signerId}`
      );
    });

    it('SECURITY: Should isolate errors - one signer failure cannot affect others', async () => {
      // SECURITY PROPERTY: Signer errors are isolated
      mockAuthShareCache.getAuthShare.mockImplementation(async (deviceId, authData) => {
        if (authData.jwt === SIGNER_SCENARIOS.signer1.authData.jwt) {
          throw new Error('Signer 1 auth error');
        }
        if (authData.jwt === SIGNER_SCENARIOS.signer2.authData.jwt) {
          return {
            authKeyShare: SIGNER_SCENARIOS.signer2.authShare,
            deviceKeyShareHash: 'h(xyz)',
            signerId: SIGNER_SCENARIOS.signer2.signerId,
          };
        }
        throw new Error('Unexpected auth data');
      });

      // Signer 1 should fail
      await expect(
        service.reconstructMasterSecret(SIGNER_SCENARIOS.signer1.authData)
      ).rejects.toThrow('Signer 1 auth error');

      // Signer 2 should still work
      const result2 = await service.reconstructMasterSecret(SIGNER_SCENARIOS.signer2.authData);
      expect(result2).toEqual(MOCK_MASTER_SECRET);
    });

    it('SECURITY: Should handle missing device share for one signer without affecting others', async () => {
      // SECURITY PROPERTY: Missing shares are isolated per signer
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer1.signerId}`) return null; // Missing
        if (key === `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer2.signerId}`)
          return SIGNER_SCENARIOS.signer2.deviceShare;
        return null;
      });

      // Signer 1 should return null (missing device share)
      const result1 = await service.reconstructMasterSecret(SIGNER_SCENARIOS.signer1.authData);
      expect(result1).toBeNull();

      // Signer 2 should still work normally
      const result2 = await service.reconstructMasterSecret(SIGNER_SCENARIOS.signer2.authData);
      expect(result2).toEqual(MOCK_MASTER_SECRET);
    });

    it('SECURITY: Should isolate tampering cleanup to affected signer only', async () => {
      // SECURITY PROPERTY: Tampering detection cleanup is signer-specific
      mockAuthShareCache.getAuthShare.mockImplementation(async (deviceId, authData) => {
        if (authData.jwt === SIGNER_SCENARIOS.signer1.authData.jwt) {
          return {
            authKeyShare: SIGNER_SCENARIOS.signer1.authShare,
            deviceKeyShareHash: 'different-hash', // Hash mismatch = tampering
            signerId: SIGNER_SCENARIOS.signer1.signerId,
          };
        }
        if (authData.jwt === SIGNER_SCENARIOS.signer2.authData.jwt) {
          return {
            authKeyShare: SIGNER_SCENARIOS.signer2.authShare,
            deviceKeyShareHash: 'h(xyz)', // Valid hash
            signerId: SIGNER_SCENARIOS.signer2.signerId,
          };
        }
        throw new Error('Unexpected auth data');
      });

      // Signer 1 should fail with tampering error
      await expect(
        service.reconstructMasterSecret(SIGNER_SCENARIOS.signer1.authData)
      ).rejects.toThrow(/Key share stored on this device does not match/);

      // Verify cleanup occurred
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer1.signerId}`
      );
      expect(mockDeviceService.clearId).toHaveBeenCalled();
      expect(mockAuthShareCache.clearCache).toHaveBeenCalled();

      // Signer 2 should still work after device ID regeneration
      mockLocalStorage.getItem.mockImplementation(key => {
        if (key === `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer2.signerId}`)
          return SIGNER_SCENARIOS.signer2.deviceShare;
        return null;
      });

      const result2 = await service.reconstructMasterSecret(SIGNER_SCENARIOS.signer2.authData);
      expect(result2).toEqual(MOCK_MASTER_SECRET);
    });
  });
});
