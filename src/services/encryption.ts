import { CipherSuite, HkdfSha384, Aes256Gcm, DhkemP384HkdfSha384 } from '@hpke/core';
import type { XMIFService } from './service';

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
    this.ephemeralKeyPair = await this.suite.kem.generateKeyPair();
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
}
