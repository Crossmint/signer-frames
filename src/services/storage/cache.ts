import { CrossmintFrameService } from '../service';
import { z } from 'zod';

export interface CacheService<T extends string | object | number = Record<string, unknown>> {
  set(key: string, value: T, ttl_ms?: number): void;
  get(key: string, schema?: z.ZodSchema): T | null;
  remove(key: string): void;
}

/**
 * Represents a cache entry with a value and optional expiration time.
 * @template T - The type of the cached value, must be string, object, or number
 */
interface CacheEntry<T extends string | object | number> {
  /** The cached value */
  value: T;
  /** Timestamp when the entry expires, or null if it never expires */
  expiresAt: number | null;
}

/**
 * In-memory cache service that provides key-value storage with optional TTL (time-to-live).
 * Extends CrossmintFrameService and includes automatic cleanup of expired entries.
 * @template T - The type of values stored in the cache, defaults to Record<string, unknown>
 */
export class InMemoryCacheService<T extends string | object | number = Record<string, unknown>>
  extends CrossmintFrameService
  implements CacheService<T>
{
  name = 'In Memory Cache Service';
  log_prefix = '[InMemoryCacheService]';

  private cache: Record<string, CacheEntry<T>> = {};
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Creates a new InMemoryCacheService instance.
   */
  constructor() {
    super();
  }

  /**
   * Initializes the cache service and starts the cleanup interval for expired entries.
   * The cleanup runs every 10 seconds to remove expired cache entries.
   */
  async init() {
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 10_000);
  }

  /**
   * Destroys the cache service and cleans up resources.
   * Clears the cleanup interval to prevent memory leaks.
   */
  destroy() {
    if (this.cleanupInterval != null) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Stores a value in the cache with an optional time-to-live.
   * @param key - The cache key to store the value under
   * @param value - The value to cache
   * @param ttl_ms - Optional time-to-live in milliseconds. If not provided, the entry never expires
   */
  set(key: string, value: T, ttl_ms?: number) {
    this.cache[key] = {
      value,
      expiresAt: ttl_ms != null ? Date.now() + ttl_ms : null,
    };
  }

  /**
   * Retrieves a value from the cache.
   * @param key - The cache key to retrieve
   * @param schema - Optional Zod schema to validate the cached value
   * @returns The cached value if found and valid, null otherwise
   */
  get(key: string, schema?: z.ZodSchema): T | null {
    const entry = this.cache[key];

    if (entry == null) {
      return null;
    }

    if (entry.expiresAt != null && entry.expiresAt < Date.now()) {
      delete this.cache[key];
      return null;
    }

    if (schema != null) {
      const parsed = schema.safeParse(entry.value);
      if (parsed.success) {
        return parsed.data;
      }
    }

    return entry.value;
  }

  remove(key: string): void {
    delete this.cache[key];
  }

  /**
   * Removes expired entries from the cache.
   * This method is called automatically by the cleanup interval.
   * @private
   */
  private cleanupExpired() {
    const now = Date.now();
    for (const key in this.cache) {
      const entry = this.cache[key];
      if (entry.expiresAt != null && entry.expiresAt < now) {
        delete this.cache[key];
      }
    }
  }
}
