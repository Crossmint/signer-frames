import { combine } from 'shamir-secret-sharing';
import { XMIFService } from './service';
import type { CrossmintApiService } from './api';
import { XMIFCodedError } from './error';
import { decodeBytes, encodeBytes } from './utils';
import { CrossmintHttpError } from './request';

const DEVICE_SHARE_KEY = 'device-share';
const DEVICE_ID_KEY = 'device-id';
const HASH_ALGO = 'SHA-256';

interface AuthShardCacheEntry {
  authKeyShare: string;
  deviceKeyShareHash: string;
  signerId: string;
  timestamp: number;
}

// Chain agnostic secret sharding service
export class ShardingService extends XMIFService {
  name = 'Sharding Service';
  log_prefix = '[ShardingService]';

  private authShardCache = new Map<string, AuthShardCacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly api: CrossmintApiService) {
    super();
  }

  async init() {}

  public getDeviceId(): string {
    this.log('Attempting to get device ID from storage');

    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing != null) {
      this.log(`Found existing device ID: ${existing.substring(0, 8)}...`);
      return existing;
    }

    this.log('No existing device ID found, generating new one');
    const deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    this.log(`Successfully stored new device ID: ${deviceId.substring(0, 8)}...`);
    return deviceId;
  }

  public async reconstructMasterSecret(authData: { jwt: string; apiKey: string }) {
    const authShardData = await this.getAuthShard(authData);
    if (authShardData == null) {
      return null;
    }

    const { authKeyShare, deviceKeyShareHash, signerId } = authShardData;

    const deviceShare = localStorage.getItem(this.deviceShareStorageKey(signerId));
    if (deviceShare == null) {
      return null;
    }

    const deviceShareBytes = decodeBytes(deviceShare, 'base64');
    const hashBuffer = await crypto.subtle.digest(HASH_ALGO, deviceShareBytes);
    const reconstructedDeviceHashBase64 = encodeBytes(new Uint8Array(hashBuffer), 'base64');

    if (reconstructedDeviceHashBase64 !== deviceKeyShareHash) {
      this.clear(signerId);
      throw new XMIFCodedError(
        `Key share stored on this device does not match Crossmint held authentication share.
Actual hash of local device share: ${reconstructedDeviceHashBase64}
Expected hash from Crossmint: ${deviceKeyShareHash}`,
        'invalid-device-share'
      );
    }

    try {
      const authShareBytes = decodeBytes(authKeyShare, 'base64');
      return await combine([deviceShareBytes, authShareBytes]);
    } catch (error) {
      throw new Error(
        `Failed to recombine key shards: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getAuthShard(authData: { jwt: string; apiKey: string }): Promise<{
    authKeyShare: string;
    deviceKeyShareHash: string;
    signerId: string;
  } | null> {
    const deviceId = this.getDeviceId();
    const cacheKey = `${deviceId}-${authData.apiKey}-${authData.jwt}`;

    const cached = this.authShardCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      this.log('Using cached auth shard');
      return {
        authKeyShare: cached.authKeyShare,
        deviceKeyShareHash: cached.deviceKeyShareHash,
        signerId: cached.signerId,
      };
    }

    try {
      this.log('Fetching auth shard from API');
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

  public storeDeviceShare(signerId: string, share: string): void {
    localStorage.setItem(this.deviceShareStorageKey(signerId), share);
  }

  private deviceShareStorageKey(signerId: string): string {
    return `${DEVICE_SHARE_KEY}-${signerId}`;
  }

  private clear(signerId: string) {
    localStorage.removeItem(this.deviceShareStorageKey(signerId));
    localStorage.removeItem(DEVICE_ID_KEY);
    this.authShardCache.clear();
  }
}
