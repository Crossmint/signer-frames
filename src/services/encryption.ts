import { CipherSuite, HkdfSha384, Aes256Gcm, DhkemP384HkdfSha384 } from '@hpke/core';
import type { XMIFService } from './service';
const LOG_PREFIX = '[EncryptionService]';
const ENCRYPTION_PRIVATE_KEY_STORAGE_KEY = 'encryption-private-key';
const ENCRYPTION_PUBLIC_KEY_STORAGE_KEY = 'encryption-public-key';

export class EncryptionService implements XMIFService {
  name = 'Encryption service';
  constructor(
    private readonly suite = new CipherSuite({
      kem: new DhkemP384HkdfSha384(),
      kdf: new HkdfSha384(),
      aead: new Aes256Gcm(),
    }),
    private ephemeralKeyPair: CryptoKeyPair | null = null
  ) {}

  async init() {
    const existingKeyPair = await this.initFromLocalStorage();
    this.ephemeralKeyPair = existingKeyPair ?? (await this.suite.kem.generateKeyPair());
    await this.saveKeyPairToLocalStorage();
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
    if (!this.ephemeralKeyPair) {
      throw new Error('EncryptionService not initialized');
    }
  }

  async encrypt<T extends Record<string, unknown>>(
    data: T,
    serializedPublicKey: ArrayBuffer
  ): Promise<{ ciphertext: ArrayBuffer; encapsulatedKey: ArrayBuffer; publicKey: ArrayBuffer }> {
    this.assertInitialized();
    const pubKey = await this.suite.kem.deserializePublicKey(serializedPublicKey);
    const sender = await this.suite.createSenderContext({
      recipientPublicKey: pubKey,
    });
    const ciphertext = await sender.seal(this.serialize(data));
    return {
      ciphertext,
      // biome-ignore lint/style/noNonNullAssertion: asserted before
      publicKey: await this.suite.kem.serializePublicKey(this.ephemeralKeyPair!.publicKey),
      encapsulatedKey: sender.enc,
    };
  }

  async decrypt<T extends Record<string, unknown>>(
    ciphertext: ArrayBuffer,
    encapsulatedKey: ArrayBuffer
  ): Promise<T> {
    this.assertInitialized();
    // biome-ignore lint/style/noNonNullAssertion: asserted before
    const privKey = this.ephemeralKeyPair!.privateKey;
    const recipient = await this.suite.createRecipientContext({
      recipientKey: privKey,
      enc: encapsulatedKey,
    });
    const pt = await recipient.open(ciphertext);
    // TODO: validate the response type
    return this.deserialize<T>(pt);
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
