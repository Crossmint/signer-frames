import { CrossmintFrameService } from '../service';
import { type SenderContext } from '@hpke/core';

import type { AttestationService } from '../tee/attestation';
import {
  AES256_KEY_SPEC,
  ECDH_KEY_SPEC,
  IDENTITY_KEY_PERMISSIONS,
  IDENTITY_STORAGE_KEY,
  type EncryptionResult,
} from './encryption-consts';

import { ENCRYPTION_KEYS_STORE_NAME, type IndexedDBAdapter } from '../storage';
import {
  suite,
  encrypt as hpkeEncrypt,
  decrypt as hpkeDecrypt,
  base64ToBuffer,
  bufferToBase64,
  bufferOrStringToBuffer,
} from './lib';

export class EncryptionService extends CrossmintFrameService {
  name = 'Encryption service';
  log_prefix = '[EncryptionService]';
  private attestationService: AttestationService | null = null;

  constructor(
    private readonly indexedDB: IndexedDBAdapter,
    attestationService?: AttestationService,
    private ephemeralKeyPair: CryptoKeyPair | null = null,
    private senderContext: SenderContext | null = null,
    private aes256EncryptionKey: CryptoKey | null = null
  ) {
    super();
    if (attestationService) {
      this.setAttestationService(attestationService);
    }
  }

  setAttestationService(service: AttestationService) {
    this.attestationService = service;
  }

  private assertAttestationService(): AttestationService {
    if (!this.attestationService) {
      throw new Error('AttestationService not set');
    }
    return this.attestationService;
  }

  async init(): Promise<void> {
    try {
      this.assertAttestationService();
      await this.initEphemeralKeyPair();
      await this.initSenderContext();
      await this.initSymmetricEncryptionKey();
    } catch (error) {
      throw new Error(`Encryption initialization failed: ${error}`);
    }
  }

  assertInitialized() {
    if (!this.ephemeralKeyPair || !this.senderContext) {
      throw new Error('EncryptionService not initialized');
    }
  }

  async initEphemeralKeyPair(): Promise<void> {
    const existingKeyPair = await this.initFromIndexedDB();
    if (existingKeyPair) {
      this.ephemeralKeyPair = existingKeyPair;
    } else {
      this.ephemeralKeyPair = await this.generateKeyPair();
      await this.saveKeyPairToIndexedDB();
    }
  }

  private async initFromIndexedDB(): Promise<CryptoKeyPair | null> {
    try {
      return await this.indexedDB.getItem<CryptoKeyPair>(
        ENCRYPTION_KEYS_STORE_NAME,
        IDENTITY_STORAGE_KEY
      );
    } catch (error: unknown) {
      this.logError(`Error initializing from IndexedDB: ${error}`);
      return null;
    }
  }

  private async initSenderContext() {
    const recipientPublicKey = await this.getTeePublicKey();
    this.senderContext = await suite.createSenderContext({
      recipientPublicKey,
    });
  }

  private async saveKeyPairToIndexedDB(): Promise<void> {
    if (!this.ephemeralKeyPair) {
      throw new Error('Encryption key pair not initialized');
    }

    try {
      await this.indexedDB.setItem(
        ENCRYPTION_KEYS_STORE_NAME,
        IDENTITY_STORAGE_KEY,
        this.ephemeralKeyPair
      );
    } catch (error) {
      this.logError(`Failed to save key pair to IndexedDB: ${error}`);
      throw new Error('Failed to persist encryption keys');
    }
  }

  async getPublicKey(): Promise<string> {
    this.assertInitialized();
    const ephemeralKeyPair = this.ephemeralKeyPair as NonNullable<typeof this.ephemeralKeyPair>;
    const serializedPublicKey = await suite.kem.serializePublicKey(ephemeralKeyPair.publicKey);
    return bufferToBase64(serializedPublicKey);
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
   * @throws {Error} When encryption service is not initialized
   * @throws {Error} When encryption operation fails
   */
  async encrypt<T extends Record<string, unknown>>(
    data: T
  ): Promise<EncryptionResult<ArrayBuffer>> {
    this.assertInitialized();
    const { ephemeralKeyPair, senderContext } = {
      ephemeralKeyPair: this.ephemeralKeyPair as NonNullable<typeof this.ephemeralKeyPair>,
      senderContext: this.senderContext as NonNullable<typeof this.senderContext>,
    };

    try {
      return await hpkeEncrypt(data, senderContext, ephemeralKeyPair.publicKey);
    } catch (error) {
      this.logError(`Encryption failed: ${error}`);
      throw new Error('Failed to encrypt data');
    }
  }

  async encryptBase64<T extends Record<string, unknown>>(
    data: T
  ): Promise<EncryptionResult<string>> {
    const { ciphertext, encapsulatedKey, publicKey } = await this.encrypt(data);

    return {
      ciphertext: bufferToBase64(ciphertext),
      encapsulatedKey: bufferToBase64(encapsulatedKey),
      publicKey: bufferToBase64(publicKey),
    };
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
   * @throws {Error} When encryption service is not initialized
   * @throws {Error} When sender authentication fails (message not from expected TEE)
   * @throws {Error} When decryption operation fails
   */
  async decrypt<T extends Record<string, unknown>, U extends string | ArrayBuffer>(
    ciphertextInput: U,
    encapsulatedKeyInput: U
  ): Promise<T> {
    this.assertInitialized();
    const { ephemeralKeyPair } = {
      ephemeralKeyPair: this.ephemeralKeyPair as NonNullable<typeof this.ephemeralKeyPair>,
    };

    try {
      const attestationService = this.assertAttestationService();
      const attestationPublicKey = await attestationService.getAttestedPublicKey();
      const senderPublicKey = await suite.kem.deserializePublicKey(
        base64ToBuffer(attestationPublicKey)
      );
      return await hpkeDecrypt(
        ciphertextInput,
        encapsulatedKeyInput,
        ephemeralKeyPair.privateKey,
        senderPublicKey
      );
    } catch (error) {
      this.logError(`Decryption failed: ${error}`);
      throw new Error('Failed to decrypt data');
    }
  }

  // Key derivation

  private async deriveAES256EncryptionKey(): Promise<CryptoKey> {
    this.assertInitialized();
    const { ephemeralKeyPair } = {
      ephemeralKeyPair: this.ephemeralKeyPair as NonNullable<typeof this.ephemeralKeyPair>,
    };
    const attestationService = this.assertAttestationService();
    const recipientPublicKeyBuffer = await attestationService
      .getAttestedPublicKey()
      .then(base64ToBuffer);
    const recipientPublicKey = await suite.kem.deserializePublicKey(recipientPublicKeyBuffer);
    return crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: recipientPublicKey,
      },
      ephemeralKeyPair.privateKey,
      AES256_KEY_SPEC,
      true,
      ['decrypt']
    );
  }

  /**
   * Returns the raw bytes of the AES256 symmetric key derived from ECDH between iframe and TEE keys.
   *
   * This method exports the raw key material of the symmetric encryption key that was created
   * using Elliptic Curve Diffie-Hellman (ECDH) key exchange between:
   * - **iframe's ephemeral private key** (this client's key pair)
   * - **TEE's attested public key** (hardware-verified public key)
   *
   * The returned raw key bytes can be used for:
   * - Direct symmetric encryption/decryption operations
   * - Key derivation for additional cryptographic operations
   * - Integration with external cryptographic libraries
   *
   * The underlying key was derived via ECDH, ensuring both iframe and TEE can independently
   * compute the same shared secret without network transmission. TEE authenticity is
   * guaranteed by Intel TDX hardware attestation.
   *
   * @returns Promise resolving to Uint8Array containing the raw AES256 key bytes (32 bytes)
   * @throws {Error} When AES256 encryption key has not been initialized
   * @throws {Error} When key export operation fails
   */
  async getAES256EncryptionKey(): Promise<Uint8Array> {
    if (!this.aes256EncryptionKey) {
      throw new Error('AES256 encryption key not initialized');
    }
    return new Uint8Array(await crypto.subtle.exportKey('raw', this.aes256EncryptionKey));
  }

  private async getTeePublicKey() {
    const attestationService = this.assertAttestationService();
    const recipientPublicKeyString = await attestationService.getAttestedPublicKey();
    return await suite.kem.deserializePublicKey(base64ToBuffer(recipientPublicKeyString));
  }

  private async generateKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(ECDH_KEY_SPEC, true, IDENTITY_KEY_PERMISSIONS);
  }

  private async initSymmetricEncryptionKey() {
    this.aes256EncryptionKey = await this.deriveAES256EncryptionKey();
  }
}
