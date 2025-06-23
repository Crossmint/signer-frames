/**
 * SECURITY CRITICAL: ShardingService Test Suite
 *
 * This service handles Shamir Secret Sharing for cryptographic keys.
 * Security properties tested:
 * 1. Master secret reconstruction from auth + device shares
 * 2. Device share integrity validation via hash consistency
 * 3. Multi-signer isolation (no cross-contamination between signers)
 * 4. Secure cleanup on integrity failures
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { ShardingService } from './sharding';
import type { AuthShareCache } from '../storage/auth-share-cache';
import { CrossmintFrameCodedError } from '../api/error';

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
import type { IndexedDBAdapter } from '../storage';
const mockCombine = shamir.combine as ReturnType<typeof vi.fn>;

describe('ShardingService - Security Critical Tests', () => {
  let service: ShardingService;
  let mockAuthShareCache: MockProxy<AuthShareCache>;
  let mockDeviceService: MockProxy<DeviceService>;
  let mockIndexedDB: MockProxy<IndexedDBAdapter>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCombine.mockClear().mockImplementation(() => Promise.resolve(MOCK_MASTER_SECRET));

    // Mock browser APIs
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(TEST_DEVICE_ID),
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array([104, 40, 120, 121, 122, 41]).buffer),
      },
    });

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
    mockDeviceService = mock<DeviceService>();
    mockIndexedDB = mock<IndexedDBAdapter>();
    mockDeviceService.getId.mockReturnValue(TEST_DEVICE_ID);

    service = new ShardingService(mockAuthShareCache, mockDeviceService, mockIndexedDB);

    // Suppress console output in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  describe('Master Secret Reconstruction - Core Security Function', () => {
    beforeEach(() => {
      // Default setup: valid device share exists
      mockIndexedDB.getItem.mockImplementation(async key => {
        if (key === `${DEVICE_SHARE_KEY}-${TEST_SIGNER_ID}`) return TEST_DEVICE_SHARE;
        return null;
      });
    });

    it('SECURITY: Should successfully reconstruct master secret from valid shares', async () => {
      mockAuthShareCache.get.mockResolvedValueOnce({
        authKeyShare: 'test-auth-share',
        deviceKeyShareHash: 'h(xyz)', // Matches our btoa mock
        signerId: TEST_SIGNER_ID,
      });

      const result = await service.reconstructMasterSecret(TEST_AUTH_DATA);

      expect(mockAuthShareCache.get).toHaveBeenCalledWith(TEST_DEVICE_ID, TEST_AUTH_DATA);
      expect(mockCombine).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything(), expect.anything()])
      );
      expect(result).toEqual(MOCK_MASTER_SECRET);
    });

    it('SECURITY: Should return null when auth share is unavailable', async () => {
      mockAuthShareCache.get.mockResolvedValueOnce(null);

      const result = await service.reconstructMasterSecret(TEST_AUTH_DATA);

      expect(result).toBeNull();
      expect(mockCombine).not.toHaveBeenCalled();
    });

    it('SECURITY: Should return null when the device share is missing', async () => {
      mockAuthShareCache.get.mockResolvedValueOnce({
        authKeyShare: 'test-auth-share',
        deviceKeyShareHash: 'h(xyz)',
        signerId: TEST_SIGNER_ID,
      });

      mockIndexedDB.getItem.mockResolvedValue(null); // No device share

      const result = await service.reconstructMasterSecret(TEST_AUTH_DATA);

      expect(result).toBeNull();
      expect(mockCombine).not.toHaveBeenCalled();
    });

    it('SECURITY: Should handle cryptographic failures gracefully', async () => {
      mockAuthShareCache.get.mockResolvedValueOnce({
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
      mockIndexedDB.getItem.mockImplementation(async key => {
        if (key === `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer1.signerId}`)
          return SIGNER_SCENARIOS.signer1.deviceShare;
        if (key === `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer2.signerId}`)
          return SIGNER_SCENARIOS.signer2.deviceShare;
        if (key === `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer3.signerId}`)
          return SIGNER_SCENARIOS.signer3.deviceShare;
        return null;
      });

      // Setup isolated auth share responses
      mockAuthShareCache.get.mockImplementation(async (deviceId, authData) => {
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

    it('SECURITY: Should reconstruct multiple signers while maintaining complete isolation', async () => {
      // Clear all mocks to start fresh
      vi.clearAllMocks();

      // === Test Signer 1 ===
      const result1 = await service.reconstructMasterSecret(SIGNER_SCENARIOS.signer1.authData);
      expect(result1).toEqual(MOCK_MASTER_SECRET);

      // Verify only signer 1's device share was accessed
      expect(mockIndexedDB.getItem).toHaveBeenCalledTimes(1);
      expect(mockIndexedDB.getItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer1.signerId}`
      );

      // Verify only signer 1's auth share was accessed
      expect(mockAuthShareCache.get).toHaveBeenCalledTimes(1);
      expect(mockAuthShareCache.get).toHaveBeenCalledWith(
        TEST_DEVICE_ID,
        SIGNER_SCENARIOS.signer1.authData
      );

      // Clear mocks for next signer
      vi.clearAllMocks();

      // === Test Signer 2 ===
      const result2 = await service.reconstructMasterSecret(SIGNER_SCENARIOS.signer2.authData);
      expect(result2).toEqual(MOCK_MASTER_SECRET);

      // Verify only signer 2's device share was accessed
      expect(mockIndexedDB.getItem).toHaveBeenCalledTimes(1);
      expect(mockIndexedDB.getItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer2.signerId}`
      );

      // Verify only signer 2's auth share was accessed
      expect(mockAuthShareCache.get).toHaveBeenCalledTimes(1);
      expect(mockAuthShareCache.get).toHaveBeenCalledWith(
        TEST_DEVICE_ID,
        SIGNER_SCENARIOS.signer2.authData
      );

      // Clear mocks for next signer
      vi.clearAllMocks();

      // === Test Signer 3 ===
      const result3 = await service.reconstructMasterSecret(SIGNER_SCENARIOS.signer3.authData);
      expect(result3).toEqual(MOCK_MASTER_SECRET);

      // Verify only signer 3's device share was accessed
      expect(mockIndexedDB.getItem).toHaveBeenCalledTimes(1);
      expect(mockIndexedDB.getItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer3.signerId}`
      );

      // Verify only signer 3's auth share was accessed
      expect(mockAuthShareCache.get).toHaveBeenCalledTimes(1);
      expect(mockAuthShareCache.get).toHaveBeenCalledWith(
        TEST_DEVICE_ID,
        SIGNER_SCENARIOS.signer3.authData
      );
    });

    it('SECURITY: Should detect device share tampering with complete cleanup and signer isolation', async () => {
      // Clear all mocks to start fresh
      vi.clearAllMocks();

      // Override btoa to simulate hash mismatch for tampering detection
      vi.stubGlobal(
        'btoa',
        vi.fn(() => 'tampered-hash')
      );

      mockAuthShareCache.get.mockImplementation(async (deviceId, authData) => {
        if (authData.jwt === SIGNER_SCENARIOS.signer1.authData.jwt) {
          return {
            authKeyShare: SIGNER_SCENARIOS.signer1.authShare,
            deviceKeyShareHash: 'expected-hash', // Different from tampered-hash = tampering
            signerId: SIGNER_SCENARIOS.signer1.signerId,
          };
        }
        if (authData.jwt === SIGNER_SCENARIOS.signer2.authData.jwt) {
          return {
            authKeyShare: SIGNER_SCENARIOS.signer2.authShare,
            deviceKeyShareHash: 'tampered-hash', // Valid hash (matches btoa mock)
            signerId: SIGNER_SCENARIOS.signer2.signerId,
          };
        }
        throw new Error('Unexpected auth data');
      });

      // === Test Signer 1 Tampering Detection ===
      await expect(
        service.reconstructMasterSecret(SIGNER_SCENARIOS.signer1.authData)
      ).rejects.toThrow(/Key share stored on this device does not match/);

      // Verify the correct sequence of operations for signer 1
      expect(mockAuthShareCache.get).toHaveBeenCalledTimes(1);
      expect(mockAuthShareCache.get).toHaveBeenCalledWith(
        TEST_DEVICE_ID,
        SIGNER_SCENARIOS.signer1.authData
      );

      expect(mockIndexedDB.getItem).toHaveBeenCalledTimes(1);
      expect(mockIndexedDB.getItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer1.signerId}`
      );

      // Verify complete security cleanup occurred
      expect(mockIndexedDB.removeItem).toHaveBeenCalledTimes(1);
      expect(mockIndexedDB.removeItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer1.signerId}`
      );
      expect(mockDeviceService.clearId).toHaveBeenCalledTimes(1);
      expect(mockAuthShareCache.clearCache).toHaveBeenCalledTimes(1);

      // Clear mocks to isolate signer 2 test
      vi.clearAllMocks();

      // Setup clean environment for signer 2 after device ID regeneration
      mockIndexedDB.getItem.mockImplementation(async key => {
        if (key === `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer2.signerId}`)
          return SIGNER_SCENARIOS.signer2.deviceShare;
        return null;
      });

      // === Test Signer 2 Success After Cleanup (Isolation Verification) ===
      const result2 = await service.reconstructMasterSecret(SIGNER_SCENARIOS.signer2.authData);
      expect(result2).toEqual(MOCK_MASTER_SECRET);

      // Verify only signer 2's resources were accessed
      expect(mockAuthShareCache.get).toHaveBeenCalledTimes(1);
      expect(mockAuthShareCache.get).toHaveBeenCalledWith(
        TEST_DEVICE_ID,
        SIGNER_SCENARIOS.signer2.authData
      );

      expect(mockIndexedDB.getItem).toHaveBeenCalledTimes(1);
      expect(mockIndexedDB.getItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${SIGNER_SCENARIOS.signer2.signerId}`
      );

      // Verify no additional cleanup operations occurred for signer 2
      expect(mockIndexedDB.removeItem).not.toHaveBeenCalled();
      expect(mockDeviceService.clearId).not.toHaveBeenCalled();
      expect(mockAuthShareCache.clearCache).not.toHaveBeenCalled();
    });
  });

  describe('Device Share Integrity - Tamper Detection', () => {
    it('SECURITY: Should throw an error and clear data if the device share is tampered', async () => {
      mockAuthShareCache.get.mockResolvedValueOnce({
        authKeyShare: 'test-auth-share',
        deviceKeyShareHash: 'different-hash', // This hash does NOT match
        signerId: TEST_SIGNER_ID,
      });
      mockIndexedDB.getItem.mockImplementation(async key => {
        if (key === `${DEVICE_SHARE_KEY}-${TEST_SIGNER_ID}`) return TEST_DEVICE_SHARE;
        return null;
      });

      await expect(service.reconstructMasterSecret(TEST_AUTH_DATA)).rejects.toThrow(
        CrossmintFrameCodedError
      );

      // Verify that cleanup functions were called
      expect(mockIndexedDB.removeItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${TEST_SIGNER_ID}`
      );
      expect(mockDeviceService.clearId).toHaveBeenCalled();
      expect(mockAuthShareCache.clearCache).toHaveBeenCalled();
    });
  });

  describe('Device Share Storage - Secure On-Device Caching', () => {
    it('Should store the device share in isolated storage for the signer', async () => {
      await service.storeDeviceShare(TEST_SIGNER_ID, TEST_DEVICE_SHARE);

      expect(mockIndexedDB.setItem).toHaveBeenCalledTimes(1);
      expect(mockIndexedDB.setItem).toHaveBeenCalledWith(
        `${DEVICE_SHARE_KEY}-${TEST_SIGNER_ID}`,
        TEST_DEVICE_SHARE
      );
    });
  });
});
