/**
 * SECURITY CRITICAL: AuthShareCache Test Suite
 *
 * This service manages cached authentication shares for Shamir Secret Sharing.
 * Properties tested:
 * 1. Credential isolation - different auth contexts get separate caches
 * 2. Cache TTL enforcement - prevents stale auth share access
 * 3. Error handling - 404s return null, other errors propagate
 * 4. JWT refresh isolation - new JWTs cannot access old cached shares
 * 5. API key isolation - different apps cannot access each other's shares
 * 6. Cache clearing for security cleanup scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockServices } from '../../tests/test-utils';
import { CrossmintHttpError } from '../api/request';
import { AuthShareCache } from './auth-share-cache';

// Test constants
const TEST_DEVICE_ID = 'test-device-id';
const BASE_AUTH_DATA = { jwt: 'base-jwt', apiKey: 'base-api-key' };

describe('AuthShareCache - Security Critical Tests', () => {
  const mockServices = createMockServices();
  let service: AuthShareCache;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuthShareCache(mockServices.api);

    // Suppress console output in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  describe('Basic Cache Operations', () => {
    beforeEach(() => {
      mockServices.api.getAuthShard.mockResolvedValue({
        authKeyShare: 'test-auth-share',
        deviceKeyShareHash: 'h(xyz)',
        signerId: 'test-signer',
      });
    });

    it('Should cache auth share to reduce API calls and improve performance', async () => {
      // First call should hit API
      const result1 = await service.get(TEST_DEVICE_ID, BASE_AUTH_DATA);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({
        authKeyShare: 'test-auth-share',
        deviceKeyShareHash: 'h(xyz)',
        signerId: 'test-signer',
      });

      // Second call should use cache (no additional API call)
      const result2 = await service.get(TEST_DEVICE_ID, BASE_AUTH_DATA);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(1);
      expect(result2).toEqual(result1);
    });

    it('Should enforce cache TTL to prevent stale auth share access', async () => {
      const originalDateNow = Date.now;
      let currentTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      try {
        // First call - should cache
        await service.get(TEST_DEVICE_ID, BASE_AUTH_DATA);
        expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(1);

        // Advance time beyond cache TTL (5 minutes = 300,000ms)
        currentTime += 300001;

        // Second call should fetch fresh data due to TTL expiration
        await service.get(TEST_DEVICE_ID, BASE_AUTH_DATA);
        expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = originalDateNow;
      }
    });
  });

  describe('Error Handling - Security Boundaries', () => {
    it('Should safely handle missing auth shares (404) without exposing errors', async () => {
      const notFoundError = new CrossmintHttpError(
        404,
        'Not Found',
        'https://api.test.com/auth-shard'
      );
      mockServices.api.getAuthShard.mockRejectedValueOnce(notFoundError);

      const result = await service.get(TEST_DEVICE_ID, BASE_AUTH_DATA);

      expect(result).toBeNull();
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(1);
    });

    it('Should propagate non-404 errors for proper error handling', async () => {
      const serverError = new CrossmintHttpError(
        500,
        'Internal Server Error',
        'https://api.test.com/auth-shard'
      );
      mockServices.api.getAuthShard.mockRejectedValueOnce(serverError);

      await expect(service.get(TEST_DEVICE_ID, BASE_AUTH_DATA)).rejects.toThrow(CrossmintHttpError);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(1);
    });
  });

  describe('Credential Isolation - Cross-Access Prevention', () => {
    // SECURITY CRITICAL: These tests verify that different authentication contexts cannot access each other's cached data

    const CREDENTIAL_SCENARIOS = {
      originalUser: {
        authData: { jwt: 'user1-jwt', apiKey: 'app-api-key' },
        signerId: 'signer-user1',
        authShare: 'user1-auth-share',
      },
      differentUser: {
        authData: { jwt: 'user2-jwt', apiKey: 'app-api-key' }, // Same app, different user
        signerId: 'signer-user2',
        authShare: 'user2-auth-share',
      },
      differentApp: {
        authData: { jwt: 'user1-jwt', apiKey: 'different-app-api-key' }, // Same user, different app
        signerId: 'signer-different-app',
        authShare: 'different-app-auth-share',
      },
      completelyDifferent: {
        authData: { jwt: 'other-jwt', apiKey: 'other-api-key' }, // Different user and app
        signerId: 'signer-other',
        authShare: 'other-auth-share',
      },
    };

    beforeEach(() => {
      mockServices.api.getAuthShard.mockImplementation(async (deviceId, _, authData) => {
        const scenario = Object.values(CREDENTIAL_SCENARIOS).find(
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

    it('SECURITY: Should isolate caches when JWT changes (different users)', async () => {
      // SECURITY PROPERTY: Different JWTs = different users = separate caches

      // Original user caches their auth share
      await service.get(TEST_DEVICE_ID, CREDENTIAL_SCENARIOS.originalUser.authData);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(1);

      // Different user should trigger new API call (cache miss due to different JWT)
      await service.get(TEST_DEVICE_ID, CREDENTIAL_SCENARIOS.differentUser.authData);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(2);

      // Original user's subsequent call should still use cache
      await service.get(TEST_DEVICE_ID, CREDENTIAL_SCENARIOS.originalUser.authData);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(2);
    });

    it('SECURITY: Should isolate caches when API key changes (different apps)', async () => {
      // SECURITY PROPERTY: Different API keys = different apps = separate caches

      // Original app caches auth share
      await service.get(TEST_DEVICE_ID, CREDENTIAL_SCENARIOS.originalUser.authData);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(1);

      // Different app should trigger new API call (cache miss due to different API key)
      await service.get(TEST_DEVICE_ID, CREDENTIAL_SCENARIOS.differentApp.authData);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(2);

      // Original app's subsequent call should still use cache
      await service.get(TEST_DEVICE_ID, CREDENTIAL_SCENARIOS.originalUser.authData);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(2);
    });

    it('SECURITY: Should isolate caches when both JWT and API key change', async () => {
      // SECURITY PROPERTY: Complete credential change = complete isolation

      // Original credentials cache auth share
      await service.get(TEST_DEVICE_ID, CREDENTIAL_SCENARIOS.originalUser.authData);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(1);

      // Completely different credentials should trigger new API call
      await service.get(TEST_DEVICE_ID, CREDENTIAL_SCENARIOS.completelyDifferent.authData);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(2);

      // Original credentials should still use cache
      await service.get(TEST_DEVICE_ID, CREDENTIAL_SCENARIOS.originalUser.authData);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(2);
    });

    it('SECURITY: Should maintain completely separate caches for all credential combinations', async () => {
      // SECURITY PROPERTY: Each unique credential combination gets its own isolated cache

      // Call with all different credential combinations - each should hit API
      const scenarios = Object.values(CREDENTIAL_SCENARIOS);
      for (const scenario of scenarios) {
        await service.get(TEST_DEVICE_ID, scenario.authData);
      }
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(4);

      // Repeat all calls - each should use its respective cache (no additional API calls)
      for (const scenario of scenarios) {
        await service.get(TEST_DEVICE_ID, scenario.authData);
      }
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(4);
    });

    it('SECURITY: Should prevent access to cached shares after JWT refresh', async () => {
      // SECURITY PROPERTY: JWT refresh creates new authentication context
      const expiredJwtAuthData = { jwt: 'expired-jwt-v1', apiKey: 'app-api-key' };
      const refreshedJwtAuthData = { jwt: 'refreshed-jwt-v2', apiKey: 'app-api-key' };

      mockServices.api.getAuthShard.mockImplementation(async (deviceId, _, authData) => {
        if (authData.jwt === 'expired-jwt-v1') {
          return {
            authKeyShare: 'expired-auth-share',
            deviceKeyShareHash: 'h(xyz)',
            signerId: 'signer-expired',
          };
        }
        if (authData.jwt === 'refreshed-jwt-v2') {
          return {
            authKeyShare: 'refreshed-auth-share',
            deviceKeyShareHash: 'h(xyz)',
            signerId: 'signer-refreshed',
          };
        }
        throw new Error('Unexpected JWT');
      });

      // Cache with expired JWT
      await service.get(TEST_DEVICE_ID, expiredJwtAuthData);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(1);

      // After JWT refresh, new token should not access old cache
      await service.get(TEST_DEVICE_ID, refreshedJwtAuthData);
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(2);

      // Verify correct credential isolation
      expect(mockServices.api.getAuthShard).toHaveBeenNthCalledWith(
        1,
        TEST_DEVICE_ID,
        undefined,
        expiredJwtAuthData
      );
      expect(mockServices.api.getAuthShard).toHaveBeenNthCalledWith(
        2,
        TEST_DEVICE_ID,
        undefined,
        refreshedJwtAuthData
      );
    });
  });

  describe('Cache Management - Security Cleanup', () => {
    it('SECURITY: Should clear all cached entries for security cleanup scenarios', async () => {
      // SECURITY PROPERTY: Cache clearing enables secure cleanup on tampering detection
      mockServices.api.getAuthShard.mockImplementation(async (deviceId, _, authData) => {
        if (authData.jwt === 'test-jwt-1') {
          return { authKeyShare: 'share-1', deviceKeyShareHash: 'h(xyz)', signerId: 'signer-1' };
        }
        if (authData.jwt === 'test-jwt-2') {
          return { authKeyShare: 'share-2', deviceKeyShareHash: 'h(xyz)', signerId: 'signer-2' };
        }
        throw new Error(`Unexpected auth data: ${JSON.stringify(authData)}`);
      });

      // Populate cache with multiple entries
      await service.get(TEST_DEVICE_ID, { jwt: 'test-jwt-1', apiKey: 'api-key-1' });
      await service.get(TEST_DEVICE_ID, { jwt: 'test-jwt-2', apiKey: 'api-key-2' });
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(2);

      // Clear cache (security cleanup)
      service.clearCache();

      // Subsequent calls should hit API again (cache was cleared)
      await service.get(TEST_DEVICE_ID, { jwt: 'test-jwt-1', apiKey: 'api-key-1' });
      await service.get(TEST_DEVICE_ID, { jwt: 'test-jwt-2', apiKey: 'api-key-2' });
      expect(mockServices.api.getAuthShard).toHaveBeenCalledTimes(4);
    });
  });
});
