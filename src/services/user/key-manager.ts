import { CrossmintFrameService } from '../service';
import type { CrossmintApiService } from '../api';
import type { AuthData } from '../api/request';
import { CrossmintHttpError } from '../api/request';
import type { DeviceService } from './device';
import type { EncryptionService } from '../encryption';

/**
 * Manages the master secret for the user.
 *
 * This service is responsible for obtaining, decrypting, and caching the master secret.
 * The master secret is encrypted with an ephemeral key and fetched from the Crossmint API.
 *
 * The decrypted master secret is cached in memory for performance. The encrypted
 * master key is also cached to avoid repeated API calls.
 */
export class KeyManagerService extends CrossmintFrameService {
  name = 'Key Manager Service';
  log_prefix = '[KeyManagerService]';

  private encryptedMasterKey: string | null = null;
  private masterSecret: Uint8Array | null = null;
  private signerId: string | null = null;

  constructor(
    private readonly api: CrossmintApiService,
    private readonly deviceService: DeviceService,
    private readonly encryptionService: EncryptionService
  ) {
    super();
  }

  async init() {}

  public setEncryptedMasterKey(signerId: string, encryptedMasterKey: string) {
    this.encryptedMasterKey = encryptedMasterKey;
    this.signerId = signerId;
    // When a new key is set, the old decrypted secret is no longer valid.
    this.masterSecret = null;
  }

  /**
   * Retrieves and decrypts the master secret.
   *
   * This method performs the following steps:
   * 1. Returns the cached master secret if available.
   * 2. If not, it ensures the encrypted master key is available (fetching if necessary).
   * 3. Decrypts the encrypted master key to get the master secret.
   * 4. Caches and returns the master secret.
   *
   * Returns null if the master secret cannot be obtained.
   *
   * @param authData - Authentication credentials containing JWT and API key
   * @returns Promise resolving to the master secret bytes, or null if unavailable
   */
  public async getMasterSecret(authData: AuthData): Promise<Uint8Array | null> {
    if (this.masterSecret) {
      this.log('Using cached master secret');
      return this.masterSecret;
    }

    if (!this.encryptedMasterKey) {
      this.log('Encrypted master key not in memory, fetching from API');
      try {
        const result = await this.api.getAuthShard(this.deviceService.getId(), undefined, authData);
        this.encryptedMasterKey = result.encryptedMasterKey;
        this.signerId = result.signerId;
      } catch (e) {
        if (e instanceof CrossmintHttpError && e.status === 404) {
          return null;
        }
        throw e;
      }
    }

    // At this point, this.encryptedMasterKey should be populated.
    if (!this.encryptedMasterKey) {
      return null;
    }

    this.log('Decrypting master key');
    try {
      // The encryptedMasterKey is a stringified JSON object with ciphertext and encapsulatedKey
      const { ciphertext, encapsulatedKey } = JSON.parse(this.encryptedMasterKey);
      const decryptedData = await this.encryptionService.decrypt<{ masterSecret: string }, string>(
        ciphertext,
        encapsulatedKey
      );
      const secretBytes = new Uint8Array(Buffer.from(decryptedData.masterSecret, 'base64'));
      this.masterSecret = secretBytes;
      return this.masterSecret;
    } catch (error) {
      this.logError(`Failed to decrypt master key: ${error}`);
      // If decryption fails, clear the encrypted key to force a refetch next time.
      this.encryptedMasterKey = null;
      throw new Error('Failed to decrypt master key');
    }
  }

  public getSignerId(): string | null {
    return this.signerId;
  }

  public clearCache(): void {
    this.encryptedMasterKey = null;
    this.masterSecret = null;
    this.signerId = null;
  }
}
