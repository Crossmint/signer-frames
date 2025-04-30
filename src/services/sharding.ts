import { combine } from 'shamir-secret-sharing';
import { XMIFService } from './service';
import type { CrossmintApiService } from './api';

const AUTH_SHARE_KEY = 'auth-share';
const DEVICE_SHARE_KEY = 'device-share';

// Chain agnostic secret sharding service
export class ShardingService extends XMIFService {
  name = 'Sharding Service';
  log_prefix = '[ShardingService]';

  constructor(private readonly api: CrossmintApiService) {
    super();
  }

  async init() {}

  public getDeviceId(): string {
    this.log('Attempting to get device ID from storage');

    const existing = localStorage.getItem('deviceId');
    if (existing != null) {
      this.log(`Found existing device ID: ${existing.substring(0, 8)}...`);
      return existing;
    }

    this.log('No existing device ID found, generating new one');
    const deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
    this.log(`Successfully stored new device ID: ${deviceId.substring(0, 8)}...`);
    return deviceId;
  }

  public async getMasterSecret(authData: { jwt: string; apiKey: string }) {
    const deviceShare = this.getDeviceShare();
    if (!deviceShare) {
      throw new Error('Device share not found');
    }

    let authShare = this.getCachedAuthShare();
    if (!authShare) {
      this.log('Auth share not found in cache, fetching from API');
      const deviceId = this.getDeviceId();
      const { keyShare } = await this.api.getAuthShard(deviceId, undefined, authData);
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

  // TODO: implement cache
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
