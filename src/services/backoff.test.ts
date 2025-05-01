import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateBackoff, shouldRetry, defaultRetryConfig, type RetryConfig } from './backoff';

describe('backoff', () => {
  const customConfig: RetryConfig = {
    maxRetries: 5,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    backoffFactor: 3,
    retryStatusCodes: [429, 500],
  };

  describe('shouldRetry', () => {
    it('should correctly determine when to retry based on status code and retry count', () => {
      // Should retry when status code is in retryStatusCodes and retryCount is less than maxRetries
      expect(shouldRetry(429, 0, defaultRetryConfig)).toBe(true);

      // Should not retry if retryCount equals or exceeds maxRetries
      expect(shouldRetry(429, 3, defaultRetryConfig)).toBe(false);

      // Should not retry if status code is not in retryStatusCodes
      expect(shouldRetry(200, 0, defaultRetryConfig)).toBe(false);

      // Should respect custom config
      expect(shouldRetry(429, 3, customConfig)).toBe(true);
      expect(shouldRetry(429, 5, customConfig)).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should calculate exponential backoff with jitter', () => {
      // Basic exponential backoff
      expect(calculateBackoff(0, defaultRetryConfig)).toBe(1000);
      expect(calculateBackoff(1, defaultRetryConfig)).toBe(2000);
      expect(calculateBackoff(2, defaultRetryConfig)).toBe(4000);

      // Respect maxDelayMs
      const cappedConfig = { ...defaultRetryConfig, maxDelayMs: 3000 };
      expect(calculateBackoff(2, cappedConfig)).toBe(3000);

      // Use Retry-After header when provided
      expect(calculateBackoff(0, defaultRetryConfig, '5')).toBe(5000);

      // Jitter application
      vi.restoreAllMocks();
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(calculateBackoff(1, defaultRetryConfig)).toBe(1000); // Min jitter

      vi.restoreAllMocks();
      vi.spyOn(Math, 'random').mockReturnValue(1);
      expect(calculateBackoff(1, defaultRetryConfig)).toBe(3000); // Max jitter
    });
  });
});
