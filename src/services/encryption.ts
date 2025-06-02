import { XMIFService } from './service';
import {
  CipherSuite,
  HkdfSha384,
  Aes256Gcm,
  DhkemP384HkdfSha384,
  type SenderContext,
} from '@hpke/core';

import type { AttestationService } from './attestation';
import {
  AES256_KEY_SPEC,
  ECDH_KEY_SPEC,
  STORAGE_KEYS,
  SerializedPrivateKeySchema,
  SerializedPublicKeySchema,
  type EncryptionResult,
  type SerializedPrivateKey,
  type SerializedPublicKey,
} from './encryption-consts';

import { encodeBytes, decodeBytes } from './utils';

export class EncryptionService extends XMIFService {
  name = 'Encryption service';
  log_prefix = '[EncryptionService]';
  private cryptoApi: SubtleCrypto = crypto.subtle;
  private attestationService: AttestationService | null = null;

  constructor(
    attestationService?: AttestationService,
    private readonly suite = new CipherSuite({
      kem: new DhkemP384HkdfSha384(),
      kdf: new HkdfSha384(),
      aead: new Aes256Gcm(),
    }),
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
      this.log(`Failed to initialize encryption service: ${error}`);
      throw new Error('Encryption initialization failed');
    }
  }

  assertInitialized() {
    if (!this.ephemeralKeyPair || !this.senderContext) {
      throw new Error('EncryptionService not initialized');
    }
  }

  async initEphemeralKeyPair(): Promise<void> {
    const existingKeyPair = await this.initFromLocalStorage();
    if (existingKeyPair) {
      this.ephemeralKeyPair = existingKeyPair;
    } else {
      this.ephemeralKeyPair = await this.generateKeyPair();
      await this.saveKeyPairToLocalStorage();
    }
  }

  private async initFromLocalStorage(): Promise<CryptoKeyPair | null> {
    try {
      const existingPrivKey = localStorage.getItem(STORAGE_KEYS.PRIV_KEY);
      const existingPubKey = localStorage.getItem(STORAGE_KEYS.PUB_KEY);
      if (!existingPrivKey || !existingPubKey) {
        return null;
      }
      return {
        privateKey: await this.deserializePrivateKey(this.base64ToBuffer(existingPrivKey)),
        publicKey: await this.deserializePublicKey(this.base64ToBuffer(existingPubKey)),
      };
    } catch (error: unknown) {
      this.logError(`Error initializing from localStorage: ${error}`);
      return null;
    }
  }

  private async initSenderContext() {
    const recipientPublicKey = await this.getTeePublicKey();
    this.senderContext = await this.suite.createSenderContext({
      recipientPublicKey,
    });
  }

  private async saveKeyPairToLocalStorage(): Promise<void> {
    if (!this.ephemeralKeyPair) {
      throw new Error('Encryption key pair not initialized');
    }

    try {
      const serializedPrivKey = await this.serializePrivateKey(this.ephemeralKeyPair.privateKey);
      const serializedPubKey = await this.serializePublicKey(this.ephemeralKeyPair.publicKey);
      localStorage.setItem(STORAGE_KEYS.PRIV_KEY, this.bufferToBase64(serializedPrivKey));
      localStorage.setItem(STORAGE_KEYS.PUB_KEY, this.bufferToBase64(serializedPubKey));
    } catch (error) {
      this.logError(`Failed to save key pair to localStorage: ${error}`);
      throw new Error('Failed to persist encryption keys');
    }
  }

  async getPublicKey(): Promise<string> {
    this.assertInitialized();
    const ephemeralKeyPair = this.ephemeralKeyPair as NonNullable<typeof this.ephemeralKeyPair>;
    const serializedPublicKey = await this.suite.kem.serializePublicKey(ephemeralKeyPair.publicKey);
    return this.bufferToBase64(serializedPublicKey);
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
      const serializedPublicKey = await this.suite.kem.serializePublicKey(
        ephemeralKeyPair.publicKey
      );
      const ciphertext = await senderContext.seal(
        this.serialize({
          data,
          encryptionContext: {
            senderPublicKey: this.bufferToBase64(serializedPublicKey),
          },
        })
      );

      return {
        ciphertext,
        publicKey: serializedPublicKey,
        encapsulatedKey: senderContext.enc,
      };
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
      ciphertext: this.bufferToBase64(ciphertext),
      encapsulatedKey: this.bufferToBase64(encapsulatedKey),
      publicKey: this.bufferToBase64(publicKey),
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
      const senderPublicKey = await this.suite.kem.deserializePublicKey(
        this.base64ToBuffer(attestationPublicKey)
      );

      const recipient = await this.suite.createRecipientContext({
        recipientKey: ephemeralKeyPair.privateKey,
        enc: this.bufferOrStringToBuffer(encapsulatedKeyInput),
        senderPublicKey,
      });

      const plaintext = await recipient.open(this.bufferOrStringToBuffer(ciphertextInput));
      return this.deserialize<{ data: T }>(plaintext).data;
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
      .then(this.base64ToBuffer);
    const recipientPublicKey = await this.suite.kem.deserializePublicKey(recipientPublicKeyBuffer);
    return this.cryptoApi.deriveKey(
      {
        name: 'ECDH',
        public: recipientPublicKey,
      },
      ephemeralKeyPair.privateKey,
      AES256_KEY_SPEC,
      true,
      ['wrapKey']
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
    return new Uint8Array(await this.cryptoApi.exportKey('raw', this.aes256EncryptionKey));
  }

  private async getTeePublicKey() {
    const attestationService = this.assertAttestationService();
    const recipientPublicKeyString = await attestationService.getAttestedPublicKey();
    return await this.suite.kem.deserializePublicKey(this.base64ToBuffer(recipientPublicKeyString));
  }

  private async generateKeyPair(): Promise<CryptoKeyPair> {
    return this.cryptoApi.generateKey(ECDH_KEY_SPEC, true, ['deriveBits', 'deriveKey']);
  }

  private async initSymmetricEncryptionKey() {
    this.aes256EncryptionKey = await this.deriveAES256EncryptionKey();
  }

  // Serialization

  private serialize<T extends Record<string, unknown>>(data: T): ArrayBuffer {
    return new TextEncoder().encode(JSON.stringify(data));
  }

  private deserialize<T extends Record<string, unknown>>(data: ArrayBuffer): T {
    return JSON.parse(new TextDecoder().decode(data)) as T;
  }

  private async serializePrivateKey(key: CryptoKey): Promise<ArrayBuffer> {
    const jwk = await this.cryptoApi.exportKey('jwk', key);
    if (!('d' in jwk) || !jwk.d) {
      throw new Error('Not a private key');
    }

    const keyBundle: SerializedPrivateKey = {
      raw: jwk,
      usages: key.usages,
      algorithm: key.algorithm,
    };

    return this.serialize(SerializedPrivateKeySchema.parse(keyBundle));
  }

  private async serializePublicKey(key: CryptoKey): Promise<ArrayBuffer> {
    this.log(`Serializing public key with algorithm: ${JSON.stringify(key.algorithm)}`);
    const keyBundle: SerializedPublicKey = {
      raw: this.bufferToBase64(await this.cryptoApi.exportKey('raw', key)),
      algorithm: key.algorithm,
    };

    return this.serialize(SerializedPublicKeySchema.parse(keyBundle));
  }

  private async deserializePublicKey(serializedKey: ArrayBuffer): Promise<CryptoKey> {
    const parseResult = SerializedPublicKeySchema.safeParse(
      this.deserialize<SerializedPublicKey>(serializedKey)
    );
    if (!parseResult.success) {
      throw new Error('Invalid key serialization');
    }
    const { raw, algorithm } = parseResult.data;
    const rawBuffer = this.base64ToBuffer(raw);
    return this.cryptoApi.importKey('raw', rawBuffer, algorithm, true, []);
  }

  private async deserializePrivateKey(serializedKey: ArrayBuffer): Promise<CryptoKey> {
    const parseResult = SerializedPrivateKeySchema.safeParse(
      this.deserialize<SerializedPrivateKey>(serializedKey)
    );
    if (!parseResult.success) {
      throw new Error('Invalid key serialization');
    }
    const { raw, algorithm, usages } = parseResult.data;
    return await this.cryptoApi.importKey('jwk', raw, algorithm, true, usages);
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    return encodeBytes(new Uint8Array(buffer), 'base64');
  }

  private base64ToBuffer(base64: string): ArrayBuffer {
    return decodeBytes(base64, 'base64').buffer;
  }

  private bufferOrStringToBuffer(value: string | ArrayBuffer): ArrayBuffer {
    return typeof value === 'string' ? this.base64ToBuffer(value) : value;
  }
}
