import { XMIFService } from './service';
import {
  CipherSuite,
  HkdfSha384,
  Aes256Gcm,
  DhkemP384HkdfSha384,
  type SenderContext,
} from '@hpke/core';

import type { AttestationService } from './attestation';
import { z } from 'zod';
import {
  AES256_KEY_SPEC,
  ECDH_KEY_SPEC,
  SerializedKeySchema,
  STORAGE_KEYS,
} from './encryption-consts';

type EncryptionResult<T extends ArrayBuffer | string> = {
  ciphertext: T;
  encapsulatedKey: T;
  publicKey: T;
};

type DecryptOptions = {
  validateTeeSender: boolean;
};

export class EncryptionService extends XMIFService {
  name = 'Encryption service';
  log_prefix = '[EncryptionService]';
  private cryptoApi: SubtleCrypto = crypto.subtle;

  constructor(
    private readonly attestationService: AttestationService,
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
  }

  async init(): Promise<void> {
    try {
      await this.initEphemeralKeyPair();
      await this.initSenderContext();
      await this.initSymmetricEncryptionKey();
    } catch (error) {
      this.log(`Failed to initialize encryption service: ${error}`);
      throw new Error('Encryption initialization failed');
    }
  }

  async initEphemeralKeyPair(): Promise<void> {
    const existingKeyPair = await this.initFromSessionStorage();
    if (existingKeyPair) {
      this.ephemeralKeyPair = existingKeyPair;
    }
    this.ephemeralKeyPair = await this.generateKeyPair();
    await this.saveKeyPairToSessionStorage();
  }

  async initFromSessionStorage(): Promise<CryptoKeyPair | null> {
    try {
      const existingKeyPair = sessionStorage.getItem(STORAGE_KEYS.KEY_PAIR);

      if (!existingKeyPair) {
        return null;
      }

      return await this.deserializeKeyPair(this.base64ToArrayBuffer(existingKeyPair));
    } catch (error: unknown) {
      this.logError(`Error initializing from localStorage: ${error}`);
      return null;
    }
  }

  private async saveKeyPairToSessionStorage(): Promise<void> {
    if (
      !this.ephemeralKeyPair ||
      !this.ephemeralKeyPair.privateKey ||
      !this.ephemeralKeyPair.publicKey
    ) {
      throw new Error('Encryption key pair not initialized');
    }

    try {
      const serializedKeyPair = await this.serializeKeyPair(this.ephemeralKeyPair);
      sessionStorage.setItem(STORAGE_KEYS.KEY_PAIR, this.arrayBufferToBase64(serializedKeyPair));
    } catch (error) {
      this.logError(`Failed to save key pair to localStorage: ${error}`);
      throw new Error('Failed to persist encryption keys');
    }
  }

  assertInitialized() {
    if (!this.ephemeralKeyPair || !this.senderContext) {
      throw new Error('EncryptionService not initialized');
    }
  }

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
            senderPublicKey: this.arrayBufferToBase64(serializedPublicKey),
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
      ciphertext: this.arrayBufferToBase64(ciphertext),
      encapsulatedKey: this.arrayBufferToBase64(encapsulatedKey),
      publicKey: this.arrayBufferToBase64(publicKey),
    };
  }

  async decrypt<T extends Record<string, unknown>, U extends string | ArrayBuffer>(
    ciphertextInput: U,
    encapsulatedKeyInput: U,
    { validateTeeSender = true }: Partial<DecryptOptions> = {}
  ): Promise<T> {
    this.assertInitialized();
    const { ephemeralKeyPair } = {
      ephemeralKeyPair: this.ephemeralKeyPair as NonNullable<typeof this.ephemeralKeyPair>,
    };

    const ciphertext = this.parseBufferOrStringToBuffer(ciphertextInput);
    const encapsulatedKey = this.parseBufferOrStringToBuffer(encapsulatedKeyInput);

    try {
      const recipientConfig = {
        recipientKey: ephemeralKeyPair.privateKey,
        enc: encapsulatedKey,
      } as const;

      if (validateTeeSender) {
        const attestationPublicKey = await this.attestationService.getPublicKeyFromAttestation();
        const senderPublicKey = await this.suite.kem.deserializePublicKey(
          this.base64ToArrayBuffer(attestationPublicKey)
        );

        const recipientConfigWithSender = {
          ...recipientConfig,
          senderPublicKey,
        };

        const recipient = await this.suite.createRecipientContext(recipientConfigWithSender);
        const plaintext = await recipient.open(ciphertext);
        return this.deserialize<T>(plaintext);
      }

      const recipient = await this.suite.createRecipientContext(recipientConfig);
      const plaintext = await recipient.open(ciphertext);

      return this.deserialize<T>(plaintext);
    } catch (error) {
      this.logError(`Decryption failed: ${error}`);
      throw new Error('Failed to decrypt data');
    }
  }

  private async deriveAES256EncryptionKey(): Promise<CryptoKey> {
    this.assertInitialized();
    const { ephemeralKeyPair } = {
      ephemeralKeyPair: this.ephemeralKeyPair as NonNullable<typeof this.ephemeralKeyPair>,
    };
    const recipientPublicKeyBuffer = await this.attestationService
      .getPublicKeyFromAttestation()
      .then(this.base64ToArrayBuffer);
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

  async getAES256EncryptionKey(): Promise<Uint8Array> {
    if (!this.aes256EncryptionKey) {
      throw new Error('AES256 encryption key not initialized');
    }
    return new Uint8Array(await this.cryptoApi.exportKey('raw', this.aes256EncryptionKey));
  }

  // Initialization functions
  private async getTeePublicKey() {
    const recipientPublicKeyString = await this.attestationService.getPublicKeyFromAttestation();
    return await this.suite.kem.deserializePublicKey(
      this.base64ToArrayBuffer(recipientPublicKeyString)
    );
  }

  private async initSenderContext() {
    const recipientPublicKey = await this.getTeePublicKey();
    this.senderContext = await this.suite.createSenderContext({
      recipientPublicKey,
    });
  }

  private async generateKeyPair(): Promise<CryptoKeyPair> {
    return this.cryptoApi.generateKey(ECDH_KEY_SPEC, true, ['deriveBits', 'deriveKey']);
  }

  private async initSymmetricEncryptionKey() {
    this.aes256EncryptionKey = await this.deriveAES256EncryptionKey();
  }

  // Utility methods
  private serialize<T extends Record<string, unknown>>(data: T): ArrayBuffer {
    return new TextEncoder().encode(JSON.stringify(data));
  }

  private deserialize<T extends Record<string, unknown>>(data: ArrayBuffer): T {
    return JSON.parse(new TextDecoder().decode(data)) as T;
  }

  private async serializeKey(
    key: CryptoKey,
    options: { isPublicKey?: boolean } = {}
  ): Promise<ArrayBuffer> {
    this.log(
      `Serializing ${options.isPublicKey ? 'public' : 'private'} key with algorithm: ${JSON.stringify(
        key.algorithm
      )}`
    );

    let keyRaw: ArrayBuffer;
    if (options.isPublicKey) {
      keyRaw = await this.cryptoApi.exportKey('raw', key);
    } else {
      const jwk = await this.cryptoApi.exportKey('jwk', key);
      if (!('d' in jwk) || !jwk.d) {
        throw new Error('Not private key');
      }
      this.log('jwk.d', jwk.d);
      keyRaw = await this.base64UrlToArrayBuffer(jwk.d as string);
    }
    const keyBundle = {
      raw: keyRaw,
      usages: key.usages,
      algorithm: key.algorithm,
    };

    return new TextEncoder().encode(JSON.stringify(SerializedKeySchema.parse(keyBundle)));
  }

  private async deserializeKey(
    serializedKey: ArrayBuffer,
    options: { isPublicKey?: boolean } = {}
  ): Promise<CryptoKey> {
    const parseResult = SerializedKeySchema.safeParse(
      JSON.parse(new TextDecoder().decode(serializedKey))
    );
    if (!parseResult.success) {
      throw new Error('Invalid key serialization');
    }
    const keyBundle = parseResult.data;
    return this.cryptoApi.importKey(
      'raw',
      keyBundle.raw,
      keyBundle.algorithm,
      true,
      options.isPublicKey ? keyBundle.usages : []
    );
  }

  private async serializeKeyPair(keyPair: CryptoKeyPair): Promise<ArrayBuffer> {
    return new TextEncoder().encode(
      JSON.stringify({
        privateKey: this.arrayBufferToBase64(await this.serializeKey(keyPair.privateKey)),
        publicKey: this.arrayBufferToBase64(
          await this.serializeKey(keyPair.publicKey, {
            isPublicKey: true,
          })
        ),
      })
    );
  }

  private async deserializeKeyPair(serializedKeyPair: ArrayBuffer): Promise<CryptoKeyPair> {
    const parseResult = z
      .object({
        privateKey: z.string(),
        publicKey: z.string(),
      })
      .safeParse(JSON.parse(new TextDecoder().decode(serializedKeyPair)));
    if (!parseResult.success) {
      throw new Error('Invalid key pair serialization');
    }
    const keyPairBundle = parseResult.data;
    return {
      privateKey: await this.deserializeKey(this.base64ToArrayBuffer(keyPairBundle.privateKey)),
      publicKey: await this.deserializeKey(this.base64ToArrayBuffer(keyPairBundle.publicKey), {
        isPublicKey: true,
      }),
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  }

  private base64UrlToArrayBuffer(v: string): ArrayBuffer {
    const base64 = v.replace(/-/g, '+').replace(/_/g, '/');
    const byteString = atob(base64);
    const ret = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      ret[i] = byteString.charCodeAt(i);
    }
    return ret.buffer;
  }

  private parseBufferOrStringToBuffer(value: string | ArrayBuffer): ArrayBuffer {
    return typeof value === 'string' ? this.base64ToArrayBuffer(value) : value;
  }
}
