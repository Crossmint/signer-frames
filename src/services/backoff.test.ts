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
    it('should return true if status code is in retryStatusCodes and retryCount is less than maxRetries', () => {
      expect(shouldRetry(429, 0, defaultRetryConfig)).toBe(true);
      expect(shouldRetry(500, 2, defaultRetryConfig)).toBe(true);
    });

    it('should return false if retryCount equals or exceeds maxRetries', () => {
      expect(shouldRetry(429, 3, defaultRetryConfig)).toBe(false);
      expect(shouldRetry(429, 5, defaultRetryConfig)).toBe(false);
    });

    it('should return false if status code is not in retryStatusCodes', () => {
      expect(shouldRetry(200, 0, defaultRetryConfig)).toBe(false);
      expect(shouldRetry(404, 0, defaultRetryConfig)).toBe(false);
    });

    it('should respect custom config', () => {
      expect(shouldRetry(429, 3, customConfig)).toBe(true);
      expect(shouldRetry(429, 5, customConfig)).toBe(false);
      expect(shouldRetry(408, 0, customConfig)).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should calculate proper exponential backoff with default values', () => {
      expect(calculateBackoff(0, defaultRetryConfig)).toBe(1000);
      expect(calculateBackoff(1, defaultRetryConfig)).toBe(2000);
      expect(calculateBackoff(2, defaultRetryConfig)).toBe(4000);
    });

    it('should respect maxDelayMs', () => {
      const config = { ...defaultRetryConfig, maxDelayMs: 3000 };
      expect(calculateBackoff(0, config)).toBe(1000);
      expect(calculateBackoff(1, config)).toBe(2000);
      expect(calculateBackoff(2, config)).toBe(3000);
    });

    it('should use Retry-After header when provided', () => {
      expect(calculateBackoff(0, defaultRetryConfig, '5')).toBe(5000);
      expect(calculateBackoff(2, defaultRetryConfig, '10')).toBe(10000);
    });

    it('should ignore invalid Retry-After header values', () => {
      expect(calculateBackoff(0, defaultRetryConfig, 'invalid')).toBe(1000);
    });

    it('should apply jitter to calculated values', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(calculateBackoff(1, defaultRetryConfig)).toBe(1000);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      vi.restoreAllMocks();
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      expect(calculateBackoff(1, defaultRetryConfig)).toBe(2000);

      vi.restoreAllMocks();
      vi.spyOn(Math, 'random').mockReturnValue(1);
      expect(calculateBackoff(1, defaultRetryConfig)).toBe(3000);
    });

    it('should respect custom config values', () => {
      expect(calculateBackoff(0, customConfig)).toBe(500);
      expect(calculateBackoff(1, customConfig)).toBe(1500);
      expect(calculateBackoff(2, customConfig)).toBe(4500);
    });
  });
});
