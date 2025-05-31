import { combine } from 'shamir-secret-sharing';
import { XMIFService } from './service';
import { XMIFCodedError } from './error';
import { decodeBytes, encodeBytes } from './utils';
import type { AuthShareCache } from './auth-share-cache';

const DEVICE_SHARE_KEY = 'device-share';
const DEVICE_ID_KEY = 'device-id';
const HASH_ALGO = 'SHA-256';

export class ShardingService extends XMIFService {
  name = 'Sharding Service';
  log_prefix = '[ShardingService]';

  constructor(private readonly authShareCache: AuthShareCache) {
    super();
  }

  async init() {
    await this.authShareCache.init();
  }

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
    const deviceId = this.getDeviceId();
    const authShardData = await this.authShareCache.getAuthShare(deviceId, authData);
    if (authShardData == null) {
      return null;
    }

    const { authKeyShare, deviceKeyShareHash, signerId } = authShardData;

    const deviceShare = localStorage.getItem(this.deviceShareStorageKey(signerId));
    if (deviceShare == null) {
      return null;
    }

    const deviceShareBytes = decodeBytes(deviceShare, 'base64');
    await this.validateDeviceShareConsistency(deviceShareBytes, deviceKeyShareHash, signerId);

    try {
      const authShareBytes = decodeBytes(authKeyShare, 'base64');
      return await combine([deviceShareBytes, authShareBytes]);
    } catch (error) {
      throw new Error(
        `Failed to recombine key shards: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async validateDeviceShareConsistency(
    deviceShareBytes: Uint8Array,
    expectedDeviceKeyShareHash: string,
    signerId: string
  ): Promise<void> {
    const hashBuffer = await crypto.subtle.digest(HASH_ALGO, deviceShareBytes);
    const reconstructedDeviceHashBase64 = encodeBytes(new Uint8Array(hashBuffer), 'base64');

    if (reconstructedDeviceHashBase64 !== expectedDeviceKeyShareHash) {
      this.clear(signerId);
      throw new XMIFCodedError(
        `Key share stored on this device does not match Crossmint held authentication share.
Actual hash of local device share: ${reconstructedDeviceHashBase64}
Expected hash from Crossmint: ${expectedDeviceKeyShareHash}`,
        'invalid-device-share'
      );
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
    this.authShareCache.clearCache();
  }
}
