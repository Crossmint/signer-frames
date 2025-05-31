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
    const cacheKey = `${deviceId}-${authData.apiKey}-${authData.jwt}`;

    const cached = this.authShardCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
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
}
