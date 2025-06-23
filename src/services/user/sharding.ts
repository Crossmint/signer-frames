import { combine } from 'shamir-secret-sharing';
import { CrossmintFrameService } from '../service';
import { CrossmintFrameCodedError } from '../api/error';
import { decodeBytes, encodeBytes } from '../common/utils';
import type { AuthShareCache } from '../storage';
import type { DeviceService } from './device';
import { SHARDS_STORE_NAME, type IndexedDBAdapter } from '../storage';

const HASH_ALGO = 'SHA-256';

/**
 * Shamir Secret Sharing service for cryptographic key reconstruction.
 *
 * This service implements a secure two-factor authentication system using Shamir Secret Sharing,
 * where cryptographic keys are split into two shares:
 * - **Device Share**: Stored locally in browser IndexedDB, tied to the device
 * - **Auth Share**: Retrieved from Crossmint servers using JWT/API key authentication
 *
 * Both shares are required to reconstruct the master secret. This design ensures that:
 * - Compromising the device alone cannot access the key (needs valid authentication)
 * - Compromising authentication alone cannot access the key (needs the device)
 * - Each signer maintains isolated key shares with tamper detection
 *
 * The service includes integrity validation through cryptographic hashing to detect
 * tampering of device shares and provides secure cleanup on security violations.
 */
export class ShardingService extends CrossmintFrameService {
  name = 'Sharding Service';
  log_prefix = '[ShardingService]';

  constructor(
    private readonly authShareCache: AuthShareCache,
    private readonly deviceService: DeviceService,
    private readonly indexedDB: IndexedDBAdapter
  ) {
    super();
  }

  async init() {
    await this.authShareCache.init();
    await this.indexedDB.init();
  }

  /**
   * Stores a device share in browser IndexedDB for a specific signer.
   *
   * Device shares are stored per-signer to maintain isolation between different
   * signing contexts. The share is stored as a base64-encoded string.
   *
   * @param signerId - Unique identifier for the signer
   * @param share - Base64-encoded device share data to store
   */
  public async storeDeviceShare(signerId: string, share: string): Promise<void> {
    await this.indexedDB.setItem(SHARDS_STORE_NAME, this.deviceShareStorageKey(signerId), share);
  }

  /**
   * Reconstructs the master secret by combining device and authentication shares.
   *
   * This method performs the core Shamir Secret Sharing reconstruction:
   * 1. Retrieves the authentication share using provided credentials
   * 2. Loads the device share from IndexedDB for the authenticated signer
   * 3. Validates device share integrity through cryptographic hash verification
   * 4. Combines both shares to reconstruct the original master secret
   *
   * Returns null if either share is unavailable, ensuring graceful failure modes.
   * Throws errors for security violations (tampering) or cryptographic failures.
   *
   * @param authData - Authentication credentials containing JWT and API key
   * @param authData.jwt - JSON Web Token for user authentication
   * @param authData.apiKey - API key for application authentication
   * @returns Promise resolving to reconstructed master secret bytes, or null if shares unavailable
   * @throws {CrossmintFrameCodedError} When device share tampering is detected
   * @throws {Error} When cryptographic reconstruction fails
   */
  public async reconstructMasterSecret(authData: { jwt: string; apiKey: string }) {
    const deviceId = this.deviceService.getId();
    const authShardData = await this.authShareCache.get(deviceId, authData);
    if (authShardData == null) {
      return null;
    }

    const { authKeyShare, deviceKeyShareHash, signerId } = authShardData;

    const deviceShare = await this.indexedDB.getItem<string>(
      SHARDS_STORE_NAME,
      this.deviceShareStorageKey(signerId)
    );
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
    expectedHashBase64: string,
    signerId: string
  ): Promise<void> {
    const hashBuffer = await crypto.subtle.digest(HASH_ALGO, deviceShareBytes);
    const reconstructedDeviceHashBase64 = encodeBytes(new Uint8Array(hashBuffer), 'base64');

    if (reconstructedDeviceHashBase64 !== expectedHashBase64) {
      await this.clear(signerId);
      throw new CrossmintFrameCodedError(
        `Key share stored on this device does not match Crossmint held authentication share.
Actual hash of local device share: ${reconstructedDeviceHashBase64}
Expected hash from Crossmint: ${expectedHashBase64}`,
        'invalid-device-share'
      );
    }
  }

  private deviceShareStorageKey(signerId: string): string {
    return `device-share-${signerId}`;
  }

  private async clear(signerId: string) {
    await this.indexedDB.removeItem(SHARDS_STORE_NAME, this.deviceShareStorageKey(signerId));
    this.deviceService.clearId();
    this.authShareCache.clearCache();
  }
}
