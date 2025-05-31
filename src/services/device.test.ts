/**
 * SECURITY CRITICAL: DeviceService Test Suite
 *
 * This service manages device ID generation and storage.
 * Security properties tested:
 * 1. Device ID uniqueness and unpredictability
 * 2. Device identity persistence across sessions
 * 3. Secure cleanup when needed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceService } from './device';

// Test constants
const TEST_DEVICE_ID = '123e4567-e89b-12d3-a456-426614174000';
const DEVICE_ID_KEY = 'device-id';

describe('DeviceService - Security Critical Tests', () => {
  let service: DeviceService;
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
    });

    vi.stubGlobal('localStorage', mockLocalStorage);

    service = new DeviceService();

    // Suppress console output in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  describe('Device ID Generation - Isolation Foundation', () => {
    it('SECURITY: Should generate cryptographically random device ID when none exists', () => {
      // SECURITY PROPERTY: Each device gets a unique, unpredictable identifier
      mockLocalStorage.getItem.mockReturnValueOnce(null);

      const result = service.getId();

      expect(crypto.randomUUID).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(DEVICE_ID_KEY, TEST_DEVICE_ID);
      expect(result).toBe(TEST_DEVICE_ID);
    });

    it('SECURITY: Should reuse existing device ID to maintain device identity', () => {
      // SECURITY PROPERTY: Device identity persists across sessions
      mockLocalStorage.getItem.mockReturnValueOnce(TEST_DEVICE_ID);

      const result = service.getId();

      expect(crypto.randomUUID).not.toHaveBeenCalled();
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      expect(result).toBe(TEST_DEVICE_ID);
    });

    it('SECURITY: Should generate new device ID each time when none exists in storage', () => {
      // SECURITY PROPERTY: Multiple calls without existing storage create unique IDs
      const firstDeviceId = '123e4567-e89b-12d3-a456-426614174001';
      const secondDeviceId = '123e4567-e89b-12d3-a456-426614174002';

      mockLocalStorage.getItem.mockReturnValue(null);
      vi.mocked(crypto.randomUUID)
        .mockReturnValueOnce(firstDeviceId)
        .mockReturnValueOnce(secondDeviceId);

      const result1 = service.getId();
      const result2 = service.getId();

      expect(crypto.randomUUID).toHaveBeenCalledTimes(2);
      expect(result1).toBe(firstDeviceId);
      expect(result2).toBe(secondDeviceId);
    });
  });

  describe('Device ID Cleanup - Security Operations', () => {
    it('SECURITY: Should clear device ID from storage for security cleanup', () => {
      // SECURITY PROPERTY: Device ID can be securely removed when needed
      service.clearId();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(DEVICE_ID_KEY);
    });

    it('SECURITY: Should handle multiple clear operations safely', () => {
      // SECURITY PROPERTY: Multiple clears don't cause errors
      service.clearId();
      service.clearId();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(2);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(DEVICE_ID_KEY);
    });
  });

  describe('Device ID Persistence', () => {
    it('Should maintain device identity across service instances', () => {
      // SECURITY PROPERTY: Device identity is consistent across service recreations
      mockLocalStorage.getItem.mockReturnValue(TEST_DEVICE_ID);

      const service1 = new DeviceService();
      const service2 = new DeviceService();

      const id1 = service1.getId();
      const id2 = service2.getId();

      expect(id1).toBe(TEST_DEVICE_ID);
      expect(id2).toBe(TEST_DEVICE_ID);
      expect(crypto.randomUUID).not.toHaveBeenCalled();
    });
  });
});
