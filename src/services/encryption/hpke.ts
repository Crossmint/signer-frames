import { CrossmintFrameService } from '../service';
import { type EncryptionResult } from '@crossmint/client-signers-cryptography';
import { type EncryptionKeyProvider } from '../encryption-keys/encryption-key-provider';
import { HPKE } from '@crossmint/client-signers-cryptography';

type EncryptablePayload = Record<string, unknown>;

export interface PublicKeyProvider {
  getPublicKey(): Promise<CryptoKey>;
}

export class HPKEService extends CrossmintFrameService {
  name = 'HPKE Service';
  log_prefix = '[HPKEService]';

  constructor(
    private readonly keyRepository: EncryptionKeyProvider,
    private readonly teePublicKeyProvider: PublicKeyProvider,
    private readonly encryptionHandler: HPKE = new HPKE()
  ) {
    super();
  }

  async init(): Promise<void> {
    try {
      // The init method can be used to pre-fetch or validate the TEE public key
      await this.teePublicKeyProvider.getPublicKey();
    } catch (error) {
      this.logError(`Initialization failed: ${error}`);
      throw new Error('Encryption initialization failed');
    }
  }

  /**
   * Encrypts data for transmission TO the attested TEE.
   *
   * Uses HPKE base mode - the client acts as sender, TEE as recipient.
   * No sender authentication is needed, user's authenticate their client devices
   * and therefore the sender key, through other means, for example an OTP,
   * This is handled outside the context of HPKE.
   * The TEE's public key authenticity is guaranteed by hardware attestation.
   *
   * @param data - Data object to encrypt
   * @returns Promise resolving to encryption result with ciphertext and encapsulated key
   * @throws {Error} When encryption operation fails
   */
  async encrypt<T extends EncryptablePayload>(data: T): Promise<EncryptionResult<ArrayBuffer>> {
    try {
      const recipientPublicKey = await this.teePublicKeyProvider.getPublicKey();
      const senderKeyPair = await this.keyRepository.getKeyPair();
      return await this.encryptionHandler.encrypt(data, recipientPublicKey, senderKeyPair);
    } catch (error) {
      this.logError(`Encryption failed: ${error}`);
      throw new Error('Failed to encrypt data');
    }
  }

  async encryptRaw(data: ArrayBuffer): Promise<EncryptionResult<ArrayBuffer>> {
    try {
      const recipientPublicKey = await this.teePublicKeyProvider.getPublicKey();
      return await this.encryptionHandler.encryptRaw(data, recipientPublicKey);
    } catch (error) {
      this.logError(`Encryption failed: ${error}`);
      throw new Error('Failed to encrypt data');
    }
  }

  async encryptBase64<T extends Record<string, unknown>>(
    data: T
  ): Promise<EncryptionResult<string>> {
    try {
      const recipientPublicKey = await this.teePublicKeyProvider.getPublicKey();
      const senderKeyPair = await this.keyRepository.getKeyPair();
      return await this.encryptionHandler.encryptBase64(data, recipientPublicKey, senderKeyPair);
    } catch (error) {
      this.logError(`Encryption failed: ${error}`);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts messages received FROM the attested TEE.
   *
   * Uses HPKE auth mode to cryptographically verify that messages originated
   * from the genuine attested TEE. This prevents impersonation attacks where
   * malicious actors attempt to send fake messages claiming to be from the TEE.
   *
   * The sender verification happens automatically during HPKE decryption - if the
   * message wasn't sent by the expected TEE (attested public key), decryption fails.
   *
   * @param ciphertextInput - Encrypted message data (string or ArrayBuffer)
   * @param encapsulatedKeyInput - HPKE encapsulated key (string or ArrayBuffer)
   * @param senderPublicKeyInput - Optional sender public key (defaults to attested TEE key)
   * @returns Promise resolving to decrypted data
   * @throws {Error} When decryption operation fails
   */
  async decrypt<T extends EncryptablePayload, U extends string | ArrayBuffer>(
    ciphertextInput: U,
    encapsulatedKeyInput: U
  ): Promise<T> {
    try {
      const keyPair = await this.keyRepository.getKeyPair();
      const senderPublicKey = await this.teePublicKeyProvider.getPublicKey();
      return await this.encryptionHandler.decrypt(
        ciphertextInput,
        encapsulatedKeyInput,
        keyPair,
        senderPublicKey
      );
    } catch (error) {
      this.logError(`Decryption failed: ${error}`);
      throw new Error('Failed to decrypt data');
    }
  }
}
