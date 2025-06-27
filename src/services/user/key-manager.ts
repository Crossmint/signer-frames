import { CrossmintFrameService } from '../service';
import { KeyPairProvider, AesGcm } from '@crossmint/client-signers-cryptography';
import { decodeBytes, encodeBytes } from '@crossmint/client-signers-cryptography';
import { PublicKeyDeserializer } from '../encryption-keys/tee-key-provider';
import { AuthData } from '../api/request';
import { CrossmintApiService } from '../api';
import { DeviceService } from './device';
import { CacheService, InMemoryCacheService } from '../storage/cache';
import { deriveSymmetricKey } from '@crossmint/client-signers-cryptography';
import {
  HashedEncryptedMasterSecret,
  hashedEncryptedMasterSecretSchema,
  UserMasterSecretHash,
} from './schemas';

/**
 * Manages user master secrets with secure storage and retrieval.
 *
 * The UserMasterSecretManager handles the encryption, decryption, and verification of user master secrets
 * using a combination of local caching, API storage, and TEE-based encryption. It ensures that
 * master secrets are properly authenticated and verified before use.
 */
export class UserMasterSecretManager extends CrossmintFrameService {
  name = 'User Master Secret Manager';
  log_prefix = '[UserMasterSecretManager]';

  /**
   * Creates a new UserKeyManager instance.
   *
   * @param api - Service for API communication to retrieve encrypted master secrets given user authentication data
   * @param keyProvider - Provider for cryptographic key pairs used in encryption/decryption
   * @param deviceService - Service for managing device information
   * @param cache - In-memory cache service for storing encrypted master secrets locally
   * @param hkpe - AES-GCM encryption handler for encrypting/decrypting the master secret
   */
  constructor(
    private readonly api: CrossmintApiService,
    private readonly keyProvider: KeyPairProvider,
    private readonly deviceService: DeviceService,
    private readonly cache: CacheService,
    private readonly hkpe = new AesGcm()
  ) {
    super();
  }

  /**
   * Attempts to retrieve and decrypt a user's master secret.
   *
   * This method first tries to get the encrypted master secret from cache, then from the API
   * if not cached. It then verifies and decrypts the master secret before returning it.
   *
   * @param authData - Authentication data required for API requests
   * @returns Promise that resolves to the decrypted master secret as Uint8Array, or null if retrieval/decryption fails
   * @throws Error if decryption fails or if the device didn't complete the onboarding process yet.
   */
  async tryGetAndDecryptMasterSecret(authData: AuthData): Promise<Uint8Array | null> {
    const encryptedMasterSecret =
      (await this.tryGetFromCache()) ?? (await this.tryGetFromApi(authData));

    if (!encryptedMasterSecret) return null;

    try {
      const masterSecret = await this.verifyAndReconstructMasterSecret(encryptedMasterSecret);
      return new Uint8Array(masterSecret);
    } catch (e: unknown) {
      this.logError('Error decrypting master secret', e);
      return null;
    }
  }

  /**
   * Attempts to retrieve the encrypted master secret from local cache.
   *
   * @returns Promise that resolves to the cached encrypted master secret, or null if not found
   * @private
   */
  private async tryGetFromCache(): Promise<HashedEncryptedMasterSecret | null> {
    const cached = this.cache.get('encryptedMasterSecret', hashedEncryptedMasterSecretSchema);
    return cached as HashedEncryptedMasterSecret | null;
  }

  /**
   * Attempts to retrieve the encrypted master secret from the API and caches it locally.
   *
   * @param authData - Authentication data required for the API request
   * @returns Promise that resolves to the encrypted master secret from API, or null if request fails
   * @private
   */
  private async tryGetFromApi(authData: AuthData): Promise<HashedEncryptedMasterSecret | null> {
    try {
      const encryptedMasterSecret = await this.api.getEncryptedMasterSecret(
        this.deviceService.getId(),
        authData
      );
      return encryptedMasterSecret;
    } catch (error) {
      this.logError('Error getting encrypted master secret from API:', error, '. Continuing...');
      return null;
    }
  }

  /**
   * Verifies and reconstructs the master secret from encrypted data.
   *
   * This method decrypts the encrypted user master secret using the derived symmetric encryption key.
   * It then verifies the integrity of the decrypted master secret by comparing its hash.
   *
   * @param hashedEncryptedMasterSecret - Object containing the encrypted user master secret and its hash
   * @param hashedEncryptedMasterSecret.encryptedUserKey - The encrypted user master secret data
   * @param hashedEncryptedMasterSecret.userKeyHash - Hash of the original master secret for verification
   * @returns Promise that resolves to the decrypted master secret
   * @throws Error if decryption fails or hash verification fails
   * @private
   */
  async verifyAndReconstructMasterSecret({
    deviceId,
    encryptedUserKey,
    userKeyHash,
  }: HashedEncryptedMasterSecret) {
    const teePublicKey = encryptedUserKey.encryptionPublicKey;
    try {
      const encryptionKey = await this.deriveSymmetricEncryptionKey(teePublicKey);
      const masterSecret = await this.hkpe.decrypt(
        decodeBytes(encryptedUserKey.bytes, encryptedUserKey.encoding),
        encryptionKey
      );

      this.verifyHash(new Uint8Array(masterSecret), userKeyHash);
      this.verifyDeviceId(deviceId);

      this.cacheMasterSecret({
        deviceId,
        encryptedUserKey,
        userKeyHash,
      });
      return masterSecret;
    } catch (error) {
      console.error('Error decrypting master secret', error);
      this.cache.remove('encryptedMasterSecret');
      throw error;
    }
  }

  private async cacheMasterSecret(encryptedMasterSecret: HashedEncryptedMasterSecret) {
    this.cache.set('encryptedMasterSecret', encryptedMasterSecret, 1000 * 60 * 5); // 5 minutes
  }

  private verifyDeviceId(deviceId: string) {
    if (deviceId !== this.deviceService.getId()) {
      throw new Error('Device ID of decrypted master secret does not match');
    }
  }

  /**
   * Verifies that the user key hash matches the expected hash.
   *
   * This method computes the hash of the provided user key and compares it with the expected
   * hash to ensure data integrity.
   *
   * @param userKey - The user key to verify
   * @param userKeyHash - Expected hash information including algorithm and encoded bytes
   * @throws Error if the computed hash does not match the expected hash
   * @private
   */
  private async verifyHash(userKey: Uint8Array, userKeyHash: UserMasterSecretHash) {
    const hash = await crypto.subtle.digest(userKeyHash.algorithm, userKey);
    const reconstructedUserKeyHash = encodeBytes(new Uint8Array(hash), userKeyHash.encoding);
    if (reconstructedUserKeyHash !== userKeyHash.bytes) {
      throw new Error('User key hash does not match');
    }
    console.log('User key hash verified');
  }

  /**
   * Derives a symmetric encryption key from the device's private key and TEE public key.
   *
   * This method uses ECDH key derivation to create a shared symmetric key between the
   * device and the Trusted Execution Environment (TEE).
   *
   * @param teePublicKey - The TEE's public key in string format
   * @returns Promise that resolves to the derived symmetric encryption key
   * @throws Error if key derivation fails
   * @private
   */
  private async deriveSymmetricEncryptionKey(teePublicKey: string): Promise<CryptoKey> {
    const keyPair = await this.keyProvider.getKeyPair();
    const publicKey = await new PublicKeyDeserializer().deserialize(teePublicKey);
    const encryptionKey = await deriveSymmetricKey(keyPair.privateKey, publicKey);
    return encryptionKey;
  }
}
