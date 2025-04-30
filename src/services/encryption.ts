import { XMIFService } from './service';
import {
  CipherSuite,
  HkdfSha384,
  Aes256Gcm,
  DhkemP384HkdfSha384,
  type SenderContext,
} from '@hpke/core';

import type { AttestationService } from './attestation';
const ENCRYPTION_PRIVATE_KEY_STORAGE_KEY = 'encryption-private-key';
const ENCRYPTION_PUBLIC_KEY_STORAGE_KEY = 'encryption-public-key';
export type EncryptionData = {
  publicKey: string;
  type: 'P384';
  encoding: 'base64';
};

export class EncryptionService extends XMIFService {
  name = 'Encryption service';
  log_prefix = '[EncryptionService]';
  constructor(
    private readonly attestationService: AttestationService,
    private readonly suite = new CipherSuite({
      kem: new DhkemP384HkdfSha384(),
      kdf: new HkdfSha384(),
      aead: new Aes256Gcm(),
    }),
    private ephemeralKeyPair: CryptoKeyPair | null = null,
    private senderContext: SenderContext | null = null
  ) {
    super();
  }

  async init() {
    const existingKeyPair = await this.initFromLocalStorage();
    this.ephemeralKeyPair = existingKeyPair ?? (await this.suite.kem.generateKeyPair());
    await this.saveKeyPairToLocalStorage();
    const recipientPublicKeyString = await this.attestationService.getPublicKeyFromAttestation();
    const recipientPublicKey = await this.suite.kem.deserializePublicKey(
      this.base64ToArrayBuffer(recipientPublicKeyString)
    );
    console.log(
      '[DEBUG] Sender key usages:',
      JSON.stringify(this.ephemeralKeyPair.privateKey.usages)
    );
    this.senderContext = await this.suite.createSenderContext({
      // senderKey: this.ephemeralKeyPair.publicKey,
      recipientPublicKey,
    });
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
      this.logError(`Error initializing from localStorage: ${error}`);
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
    const serializedPublicKey = await this.suite.kem.serializePublicKey(ephemeralKeyPair.publicKey);
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
  }

  async encryptBase64<T extends Record<string, unknown>>(
    data: T
  ): Promise<{ ciphertext: string; encapsulatedKey: string; publicKey: string }> {
    const { ciphertext, encapsulatedKey, publicKey } = await this.encrypt(data);
    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      encapsulatedKey: this.arrayBufferToBase64(encapsulatedKey),
      publicKey: this.arrayBufferToBase64(publicKey),
    };
  }

  async decrypt<T extends Record<string, unknown>>(
    ciphertext: ArrayBuffer,
    encapsulatedKey: ArrayBuffer,
    { validateTeeSender }: { validateTeeSender: boolean } = { validateTeeSender: true }
  ): Promise<T> {
    const { ephemeralKeyPair } = this.assertInitialized();
    const privKey = ephemeralKeyPair.privateKey;
    const recipient = await this.suite.createRecipientContext({
      recipientKey: privKey,
      enc: encapsulatedKey,
      ...(validateTeeSender
        ? {
            senderPublicKey: await this.suite.kem.deserializePublicKey(
              this.base64ToArrayBuffer(await this.attestationService.getPublicKeyFromAttestation())
            ),
          }
        : {}),
    });
    const pt = await recipient.open(ciphertext);
    // TODO: validate the response type
    return this.deserialize<T>(pt);
  }

  async decryptBase64<T extends Record<string, unknown>>(
    ciphertext: string,
    encapsulatedKey: string,
    { validateTeeSender }: { validateTeeSender: boolean } = { validateTeeSender: true }
  ) {
    return this.decrypt<{ data: T }>(
      this.base64ToArrayBuffer(ciphertext),
      this.base64ToArrayBuffer(encapsulatedKey),
      { validateTeeSender }
    ).then(response => response.data);
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

  async getPublicKey() {
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
