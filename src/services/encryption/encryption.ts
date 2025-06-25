import { CrossmintFrameService } from '../service';
import {
  CipherSuite,
  Aes256Gcm,
  DhkemP256HkdfSha256,
  HkdfSha256,
  type SenderContext,
} from '@hpke/core';

import { type EncryptionResult } from './encryption-consts';

import { encodeBytes, decodeBytes } from '../common/utils';
import { type KeyRepository } from '../keys/key-repository';

type EncryptablePayload = Record<string, unknown>;

export interface TeePublicKeyProvider {
  getPublicKey(): Promise<CryptoKey>;
}

export class EncryptionService extends CrossmintFrameService {
  name = 'Encryption service';
  log_prefix = '[EncryptionService]';
  private senderContext: SenderContext | null = null;

  constructor(
    private readonly keyRepository: KeyRepository,
    private readonly teePublicKeyProvider: TeePublicKeyProvider,
    private readonly suite = new CipherSuite({
      kem: new DhkemP256HkdfSha256(),
      kdf: new HkdfSha256(),
      aead: new Aes256Gcm(),
    })
  ) {
    super();
  }

  async init(): Promise<void> {
    try {
      await this.initSenderContext();
    } catch (error) {
      throw new Error('Encryption initialization failed');
    }
  }

  assertInitialized() {
    if (!this.senderContext) {
      throw new Error('EncryptionService not initialized');
    }
  }

  private async initSenderContext() {
    const recipientPublicKey = await this.teePublicKeyProvider.getPublicKey();
    this.senderContext = await this.suite.createSenderContext({
      recipientPublicKey,
    });
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
  async encrypt<T extends EncryptablePayload>(data: T): Promise<EncryptionResult<ArrayBuffer>> {
    const keyPair = await this.keyRepository.getKeyPair();
    const serializedPublicKey = await this.suite.kem.serializePublicKey(keyPair.publicKey);
    return this.encryptRaw(
      this.serialize({
        data,
        encryptionContext: {
          senderPublicKey: this.bufferToBase64(serializedPublicKey),
        },
      })
    );
  }

  async encryptRaw(data: ArrayBuffer): Promise<EncryptionResult<ArrayBuffer>> {
    this.assertInitialized();
    const senderContext = this.senderContext as NonNullable<typeof this.senderContext>;
    try {
      const ciphertext = await senderContext.seal(data);

      return {
        ciphertext,
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
    const { ciphertext, encapsulatedKey } = await this.encrypt(data);

    return {
      ciphertext: this.bufferToBase64(ciphertext),
      encapsulatedKey: this.bufferToBase64(encapsulatedKey),
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
  async decrypt<T extends EncryptablePayload, U extends string | ArrayBuffer>(
    ciphertextInput: U,
    encapsulatedKeyInput: U
  ): Promise<T> {
    const keyPair = await this.keyRepository.getKeyPair();

    try {
      const senderPublicKey = await this.teePublicKeyProvider.getPublicKey();

      const recipient = await this.suite.createRecipientContext({
        recipientKey: keyPair.privateKey,
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

  // Serialization
  private serialize<T extends EncryptablePayload>(data: T): ArrayBuffer {
    return new TextEncoder().encode(JSON.stringify(data));
  }

  private deserialize<T extends EncryptablePayload>(data: ArrayBuffer): T {
    return JSON.parse(new TextDecoder().decode(data)) as T;
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
