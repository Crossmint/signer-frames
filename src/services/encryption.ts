import type { XMIFService } from './service';
import {
  CipherSuite,
  HkdfSha384,
  Aes256Gcm,
  DhkemP384HkdfSha384,
  type SenderContext,
} from '@hpke/core';

const LOG_PREFIX = '[EncryptionService]';
const ENCRYPTION_PRIVATE_KEY_STORAGE_KEY = 'encryption-private-key';
const ENCRYPTION_PUBLIC_KEY_STORAGE_KEY = 'encryption-public-key';
export type EncryptionData = {
  publicKey: string;
  type: 'P384';
  encoding: 'base64';
};

export class EncryptionService implements XMIFService {
  name = 'Encryption service';
  constructor(
    private readonly suite = new CipherSuite({
      kem: new DhkemP384HkdfSha384(),
      kdf: new HkdfSha384(),
      aead: new Aes256Gcm(),
    }),
    private ephemeralKeyPair: CryptoKeyPair | null = null,
    private senderContext: SenderContext | null = null
  ) {}

  async init() {
    const existingKeyPair = await this.initFromLocalStorage();
    this.ephemeralKeyPair = existingKeyPair ?? (await this.suite.kem.generateKeyPair());
    await this.saveKeyPairToLocalStorage();
    this.senderContext = await this.suite.createSenderContext({
      recipientPublicKey: await this.getRecipientPubKey(),
    });
  }

  async getRecipientPubKey(): Promise<CryptoKey> {
    return (await this.suite.kem.generateKeyPair()).publicKey;
  }

  async initFromLocalStorage() {
    try {
      const existingPrivateKey = localStorage.getItem(ENCRYPTION_PRIVATE_KEY_STORAGE_KEY);
      const existingPublicKey = localStorage.getItem(ENCRYPTION_PUBLIC_KEY_STORAGE_KEY);
      if (!existingPrivateKey || !existingPublicKey) {
        return null;
      }
      return {
        privateKey: await this.suite.kem.deserializePrivateKey(
          this.base64ToArrayBuffer(existingPrivateKey)
        ),
        publicKey: await this.suite.kem.deserializePublicKey(
          this.base64ToArrayBuffer(existingPublicKey)
        ),
      };
    } catch (error: unknown) {
      console.error(`${LOG_PREFIX} Error initializing from localStorage: ${error}`);
      return null;
    }
  }

  private async saveKeyPairToLocalStorage() {
    if (!this.ephemeralKeyPair) {
      throw new Error('Encryption key pair not initialized');
    }

    const privateKeyBuffer = await this.suite.kem.serializePrivateKey(
      this.ephemeralKeyPair.privateKey
    );
    const publicKeyBuffer = await this.suite.kem.serializePublicKey(
      this.ephemeralKeyPair.publicKey
    );
    localStorage.setItem(
      ENCRYPTION_PRIVATE_KEY_STORAGE_KEY,
      this.arrayBufferToBase64(privateKeyBuffer)
    );
    localStorage.setItem(
      ENCRYPTION_PUBLIC_KEY_STORAGE_KEY,
      this.arrayBufferToBase64(publicKeyBuffer)
    );
  }

  private assertInitialized() {
    if (!this.ephemeralKeyPair || !this.senderContext) {
      throw new Error('EncryptionService not initialized');
    }
    return {
      ephemeralKeyPair: this.ephemeralKeyPair,
      senderContext: this.senderContext,
    };
  }

  async encrypt<T extends Record<string, unknown>>(
    data: T
  ): Promise<{ ciphertext: ArrayBuffer; encapsulatedKey: ArrayBuffer; publicKey: ArrayBuffer }> {
    const { ephemeralKeyPair, senderContext } = this.assertInitialized();
    const ciphertext = await senderContext.seal(this.serialize(data));
    return {
      ciphertext,
      publicKey: await this.suite.kem.serializePublicKey(ephemeralKeyPair.publicKey),
      encapsulatedKey: senderContext.enc,
    };
  }

  async decrypt<T extends Record<string, unknown>>(
    ciphertext: ArrayBuffer,
    encapsulatedKey: ArrayBuffer
  ): Promise<T> {
    const { ephemeralKeyPair } = this.assertInitialized();
    const privKey = ephemeralKeyPair.privateKey;
    const recipient = await this.suite.createRecipientContext({
      recipientKey: privKey,
      enc: encapsulatedKey,
    });
    const pt = await recipient.open(ciphertext);
    // TODO: validate the response type
    return this.deserialize<T>(pt);
  }

  async decryptBase64<T extends Record<string, unknown>>(
    ciphertext: string,
    encapsulatedKey: string
  ) {
    return this.decrypt<T>(
      this.base64ToArrayBuffer(ciphertext),
      this.base64ToArrayBuffer(encapsulatedKey)
    );
  }

  async getEncryptionData(): Promise<EncryptionData> {
    this.assertInitialized();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const publicCryptoKey = this.ephemeralKeyPair!.publicKey;
    const publicKey = await this.suite.kem.serializePublicKey(publicCryptoKey);
    return {
      publicKey: this.arrayBufferToBase64(publicKey),
      type: 'P384',
      encoding: 'base64',
    };
  }

  private serialize<T extends Record<string, unknown>>(data: T) {
    return new TextEncoder().encode(JSON.stringify(data));
  }

  private deserialize<T extends Record<string, unknown>>(data: ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(data)) as T;
  }

  getPublicKey() {
    this.assertInitialized();
    // biome-ignore lint/style/noNonNullAssertion: asserted before
    return this.suite.kem.serializePublicKey(this.ephemeralKeyPair!.publicKey);
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
}
