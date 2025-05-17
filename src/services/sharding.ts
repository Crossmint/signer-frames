import { combine } from 'shamir-secret-sharing';
import { XMIFService } from './service';
import type { CrossmintApiService } from './api';
import { XMIFCodedError } from './error';

const DEVICE_SHARE_KEY = 'device-share';
const DEVICE_ID_KEY = 'device-id';
const HASH_ALGO = 'SHA-256';

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
    const deviceShare = localStorage.getItem(DEVICE_SHARE_KEY);
    if (deviceShare == null) {
      throw new Error('Device share not found');
    }

    const deviceShareBytes = this.base64ToBytes(deviceShare);

    const { keyShare: authShare, deviceKeyShareHash: expectedDeviceHashBase64 } =
      await this.api.getAuthShard(this.getDeviceId(), undefined, authData);

    const hashBuffer = await crypto.subtle.digest(HASH_ALGO, deviceShareBytes);
    const currentHashBase64 = this.bytesToBase64(new Uint8Array(hashBuffer));

    if (currentHashBase64 !== expectedDeviceHashBase64) {
      localStorage.removeItem(DEVICE_SHARE_KEY);
      localStorage.removeItem(DEVICE_ID_KEY);
      throw new XMIFCodedError(
        `Key share stored on this device does not match Crossmint held authentication share.\n` +
          `Actual hash of local device share: ${currentHashBase64}\n` +
          `Expected hash from Crossmint: ${expectedDeviceHashBase64}`,
        'invalid-device-share'
      );
    }

    try {
      const authShareBytes = this.base64ToBytes(authShare);
      return await combine([deviceShareBytes, authShareBytes]);
    } catch (error) {
      throw new Error(
        `Failed to recombine key shards: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  public storeDeviceShare(share: string): void {
    localStorage.setItem(DEVICE_SHARE_KEY, share);
  }

  public status(): 'ready' | 'new-device' {
    if (localStorage.getItem(DEVICE_SHARE_KEY) == null) {
      return 'new-device';
    }

    return 'ready';
  }

  private base64ToBytes(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  private bytesToBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(bytes)));
  }
}
