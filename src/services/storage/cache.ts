import { CrossmintFrameService } from '../service';
import { z } from 'zod';

interface CacheEntry<T extends string | object | number> {
  value: T;
  expiresAt: number | null;
}

export class InMemoryCacheService<
  T extends string | object | number = Record<string, unknown>,
> extends CrossmintFrameService {
  name = 'In Memory Cache Service';
  log_prefix = '[InMemoryCacheService]';

  private cache: Record<string, CacheEntry<T>> = {};
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  async init() {
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 10_000);
  }

  destroy() {
    if (this.cleanupInterval != null) {
      clearInterval(this.cleanupInterval);
    }
  }

  set(key: string, value: T, ttl_ms?: number) {
    this.cache[key] = {
      value,
      expiresAt: ttl_ms != null ? Date.now() + ttl_ms : null,
    };
  }

  get(key: string, schema?: z.ZodSchema): T | null {
    const entry = this.cache[key];

    if (entry == null) {
      return null;
    }

    if (entry.expiresAt != null && entry.expiresAt < Date.now()) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
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

  private cleanupExpired() {
    const now = Date.now();
    for (const key in this.cache) {
      const entry = this.cache[key];
      if (entry.expiresAt != null && entry.expiresAt < now) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.cache[key];
      }
    }
  }
}
