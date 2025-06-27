import { CrossmintFrameService } from '../service';
import { createKEM, ECDH_KEY_SPEC } from '../encryption/lib';
import { ENCRYPTION_KEYS_STORE_NAME, type IndexedDBAdapter } from '../storage';
import { encodeBytes } from '../encryption/lib/primitives/encoding';

export const IDENTITY_STORAGE_KEY = 'encryption-key-pair';
export const IDENTITY_KEY_PERMISSIONS: KeyUsage[] = ['deriveBits', 'deriveKey'];

export class EncryptionKeyProvider extends CrossmintFrameService {
  name = 'Encryption Key Provider';
  log_prefix = '[EncryptionKeyProvider]';

  private keyPair!: CryptoKeyPair;

  constructor(private readonly storage: IndexedDBAdapter) {
    super();
  }

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

  async getKeyPair(): Promise<CryptoKeyPair> {
    return this.keyPair;
  }

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

  private async saveKeyPairToStorage(keyPair: CryptoKeyPair): Promise<void> {
    try {
      await this.storage.setItem(ENCRYPTION_KEYS_STORE_NAME, IDENTITY_STORAGE_KEY, keyPair);
    } catch (error) {
      this.logError(`Failed to save key pair to IndexedDB: ${error}`);
      throw new Error('Failed to persist encryption keys');
    }
  }

  private async generateKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(ECDH_KEY_SPEC, true, IDENTITY_KEY_PERMISSIONS);
  }

  async getSerializedPublicKey(): Promise<string> {
    const { publicKey } = await this.getKeyPair();
    const serializedPublicKey = await createKEM().serializePublicKey(publicKey);
    return encodeBytes(new Uint8Array(serializedPublicKey), 'base64');
  }
}
