/**
 * Retry with exponential backoff utilities
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryStatusCodes: number[];
}

export const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
};

export function calculateBackoff(
  retryCount: number,
  config: RetryConfig = defaultRetryConfig,
  retryAfterHeader?: string
): number {
  if (retryAfterHeader) {
    const retryAfter = Number.parseInt(retryAfterHeader, 10);
    if (!Number.isNaN(retryAfter)) {
      return retryAfter * 1000;
    }
  }

  const exponentialDelay = Math.min(
    config.maxDelayMs,
    config.initialDelayMs * config.backoffFactor ** retryCount
  );

  const jitter = 0.5 + Math.random();
  return Math.floor(exponentialDelay * jitter);
}

export function shouldRetry(
  status: number,
  retryCount: number,
  config: RetryConfig = defaultRetryConfig
): boolean {
  return retryCount < config.maxRetries && config.retryStatusCodes.includes(status);
}
