import { XMIFService } from './service';
import type { CrossmintApiService } from './api';
import { CrossmintHttpError } from './request';

interface AuthShardCacheEntry {
  authKeyShare: string;
  deviceKeyShareHash: string;
  signerId: string;
  timestamp: number;
}

interface AuthShardData {
  authKeyShare: string;
  deviceKeyShareHash: string;
  signerId: string;
}

/**
 * In-memory cache for authentication shares used in Shamir Secret Sharing.
 *
 * **IMPORTANT: This is an in-memory cache that lives within the iframe context.**
 *
 * The cache is automatically cleared when:
 * - **Page refresh/reload** - Browser discards the iframe's JavaScript context
 * - **Tab close** - Browser terminates the iframe along with its memory
 * - **Browser navigation away** - Parent page navigation destroys the iframe
 * - **Iframe removal** - Parent page removes the iframe from DOM
 * - **Browser crash/restart** - All memory is lost
 * - **Manual cache clear** - Explicit call to `clearCache()` method
 * - **Security cleanup** - Called during device share tampering detection
 *
 * The cache uses a 5-minute TTL (time-to-live) to automatically expire entries
 * and ensure auth shares don't remain in memory indefinitely. Each cache entry
 * is isolated by device ID, API key, and JWT to prevent cross-contamination
 * between different authentication contexts.
 *
 * Since this cache exists in iframe memory, it provides no persistence across
 * browser sessions and is automatically cleaned up when the iframe context ends.
 */
export class AuthShareCache extends XMIFService {
  name = 'Auth Share Cache';
  log_prefix = '[AuthShareCache]';

  private authShardCache = new Map<string, AuthShardCacheEntry>();

  constructor(
    private readonly api: CrossmintApiService,
    private readonly CACHE_TTL_MS = 5 * 60 * 1000
  ) {
    super();
  }

  async init() {}

  public async getAuthShare(
    deviceId: string,
    authData: { jwt: string; apiKey: string }
  ): Promise<AuthShardData | null> {
    const cacheKey = this.buildCacheKey(deviceId, authData);

    const cached = this.authShardCache.get(cacheKey);
    if (this.isCacheEntryValid(cached)) {
      this.log('Using cached auth share');
      return {
        authKeyShare: cached.authKeyShare,
        deviceKeyShareHash: cached.deviceKeyShareHash,
        signerId: cached.signerId,
      };
    }

    try {
      this.log('Fetching auth share from API');
      const result = await this.api.getAuthShard(deviceId, undefined, authData);
      this.authShardCache.set(cacheKey, {
        authKeyShare: result.authKeyShare,
        deviceKeyShareHash: result.deviceKeyShareHash,
        signerId: result.signerId,
        timestamp: Date.now(),
      });

      return {
        authKeyShare: result.authKeyShare,
        deviceKeyShareHash: result.deviceKeyShareHash,
        signerId: result.signerId,
      };
    } catch (e) {
      if (e instanceof CrossmintHttpError && e.status === 404) {
        return null;
      }

      throw e;
    }
  }

  public clearCache(): void {
    this.authShardCache.clear();
  }

  private buildCacheKey(deviceId: string, authData: { jwt: string; apiKey: string }): string {
    return `${deviceId}-${authData.apiKey}-${authData.jwt}`;
  }

  private isCacheEntryValid(
    cached: AuthShardCacheEntry | undefined
  ): cached is AuthShardCacheEntry {
    return cached !== undefined && Date.now() - cached.timestamp < this.CACHE_TTL_MS;
  }
}
