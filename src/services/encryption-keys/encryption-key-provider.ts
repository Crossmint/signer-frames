import { CrossmintFrameService } from '../service';
import { createKEM, ECDH_KEY_SPEC } from '@crossmint/client-signers-cryptography';
import { ENCRYPTION_KEYS_STORE_NAME, type IndexedDBAdapter } from '../storage';
import { encodeBytes } from '@crossmint/client-signers-cryptography';

/**
 * Storage key used for persisting the master frame key pair in IndexedDB
 */
export const IDENTITY_STORAGE_KEY = 'encryption-key-pair';

/**
 * Cryptographic key permissions required for the master frame key pair
 * Allows deriving bits and keys for encryption/decryption operations
 */
const IDENTITY_KEY_PERMISSIONS: KeyUsage[] = ['deriveBits', 'deriveKey'];

/**
 * Manages the master frame key pair for the frame service.
 *
 * This class is responsible for:
 * - Generating and storing master frame key pairs
 * - Retrieving key pairs from persistent storage
 * - Providing serialized public keys for external use
 * - Managing the lifecycle of frame encryption keys
 *
 * The master frame key pair is stored in IndexedDB for persistence across sessions
 * and uses ECDH (Elliptic Curve Diffie-Hellman) for key agreement.
 */
export class MasterFrameKeyProvider extends CrossmintFrameService {
  name = 'Encryption Key Provider';
  log_prefix = '[MasterFrameKeyProvider]';

  private keyPair!: CryptoKeyPair;

  /**
   * Creates a new MasterFrameKeyProvider instance
   *
   * @param storage - IndexedDB adapter for persistent key storage
   */
  constructor(private readonly storage: IndexedDBAdapter) {
    super();
  }

  /**
   * Initializes the key provider by loading or generating master frame keys
   *
   * This method:
   * 1. Attempts to load an existing master frame key pair from storage
   * 2. If no key pair exists, generates a new one and saves it
   * 3. Sets up the internal key pair for subsequent operations
   *
   * @throws {Error} When key initialization fails
   */
  async init(): Promise<void> {
    try {
      const keyPair = await this.initFromStorage();
      if (!keyPair) {
        this.keyPair = await this.generateKeyPair();
        await this.saveKeyPairToStorage(this.keyPair);
      } else {
        this.keyPair = keyPair;
      }
    } catch (error: unknown) {
      this.logError(`Error initializing from IndexedDB: ${error}`);
      throw new Error('Failed to initialize key repository');
    }
  }

  /**
   * Retrieves the current master frame key pair
   *
   * @returns The CryptoKeyPair containing public and private keys
   * @throws {Error} If called before initialization
   */
  async getKeyPair(): Promise<CryptoKeyPair> {
    return this.keyPair;
  }

  /**
   * Attempts to load an existing master frame key pair from IndexedDB storage
   *
   * @returns The stored key pair, or null if none exists or loading fails
   * @private
   */
  private async initFromStorage(): Promise<CryptoKeyPair | null> {
    try {
      return await this.storage.getItem<CryptoKeyPair>(
        ENCRYPTION_KEYS_STORE_NAME,
        IDENTITY_STORAGE_KEY
      );
    } catch (error: unknown) {
      this.logError(`Error initializing from IndexedDB: ${error}`);
      return null;
    }
  }

  /**
   * Persists a master frame key pair to IndexedDB storage
   *
   * @param keyPair - The master frame CryptoKeyPair to save
   * @throws {Error} When storage operation fails
   * @private
   */
  private async saveKeyPairToStorage(keyPair: CryptoKeyPair): Promise<void> {
    try {
      await this.storage.setItem(ENCRYPTION_KEYS_STORE_NAME, IDENTITY_STORAGE_KEY, keyPair);
    } catch (error) {
      this.logError(`Failed to save key pair to IndexedDB: ${error}`);
      throw new Error('Failed to persist encryption keys');
    }
  }

  /**
   * Generates a new ECDH master frame key pair for encryption operations
   *
   * @returns A new CryptoKeyPair suitable for key derivation
   * @private
   */
  private async generateKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(ECDH_KEY_SPEC, true, IDENTITY_KEY_PERMISSIONS);
  }

  /**
   * Serializes the public key to a base64-encoded string
   *
   * This method extracts the public key from the key pair, serializes it
   * using the KEM (Key Encapsulation Mechanism) format, and encodes it
   * as a base64 string for transmission or storage.
   *
   * @returns Base64-encoded serialized public key
   * @throws {Error} When serialization fails
   */
  async getSerializedPublicKey(): Promise<string> {
    const { publicKey } = await this.getKeyPair();
    const serializedPublicKey = await createKEM().serializePublicKey(publicKey);
    return encodeBytes(new Uint8Array(serializedPublicKey), 'base64');
  }
}
