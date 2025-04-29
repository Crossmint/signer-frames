import { combine } from 'shamir-secret-sharing';
import type { CrossmintApiService } from './api';
import type { XMIFService } from './service';

const AUTH_SHARE_KEY = 'auth-share';
const DEVICE_SHARE_KEY = 'device-share';
const LOG_PREFIX = '[ShardingService]';

// Chain agnostic secret sharding service
export class ShardingService implements XMIFService {
  name = 'Sharding Service';
  constructor(private readonly api: CrossmintApiService) {
    console.log(`${LOG_PREFIX} Initializing ShardingService`);
  }

  async init() {}

  public getDeviceId(): string {
    console.log(`${LOG_PREFIX} Attempting to get device ID from storage`);

    const existing = localStorage.getItem('deviceId');
    if (existing != null) {
      console.log(`${LOG_PREFIX} Found existing device ID: ${existing.substring(0, 8)}...`);
      return existing;
    }

    console.log(`${LOG_PREFIX} No existing device ID found, generating new one`);
    const deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
    console.log(`${LOG_PREFIX} Successfully stored new device ID: ${deviceId.substring(0, 8)}...`);
    return deviceId;
  }

  public async getMasterSecret(authData: { jwt: string; apiKey: string }) {
    const deviceShare = this.getDeviceShare();
    if (!deviceShare) {
      throw new Error('Device share not found');
    }

    let authShare = this.getCachedAuthShare();
    if (!authShare) {
      console.log(`${LOG_PREFIX} Auth share not found in cache, fetching from API`);
      const deviceId = this.getDeviceId();
      const { keyShare } = await this.api.getAuthShard(deviceId, authData);
      this.cacheAuthShare(keyShare);
      authShare = keyShare;
    }

    try {
      return await combine([this.base64ToBytes(deviceShare), this.base64ToBytes(authShare)]);
    } catch (error) {
      throw new Error(
        `Failed to recombine key shards: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  storeDeviceShare(share: string): void {
    localStorage.setItem(DEVICE_SHARE_KEY, share);
  }

  cacheAuthShare(share: string): void {
    sessionStorage.setItem(AUTH_SHARE_KEY, share);
  }

  getDeviceShare(): string | null {
    return localStorage.getItem(DEVICE_SHARE_KEY);
  }

  getCachedAuthShare(): string | null {
    return sessionStorage.getItem(AUTH_SHARE_KEY);
  }

  private base64ToBytes(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }
}
