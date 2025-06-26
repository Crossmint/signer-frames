import { SymmetricKeyProvider } from '../../../key-management/provider';

const IV_LENGTH = 12;

export class SymmetricEncryptionHandler {
  constructor(private readonly algorithm = 'AES-GCM') {}

  async encrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    const iv = await this.getIv();
    const encrypted = await crypto.subtle.encrypt({ name: this.algorithm, iv }, key, data);
    const ciphertext = new Uint8Array(iv.byteLength + encrypted.byteLength);
    ciphertext.set(iv, 0);
    ciphertext.set(new Uint8Array(encrypted), iv.byteLength);
    return ciphertext;
  }

  async decrypt(extendedCiphertext: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    const iv = extendedCiphertext.slice(0, IV_LENGTH);
    const ciphertext = extendedCiphertext.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt({ name: this.algorithm, iv }, key, ciphertext);
    return new Uint8Array(decrypted);
  }

  private async getIv(): Promise<Uint8Array> {
    const iv = new Uint8Array(IV_LENGTH);
    await crypto.getRandomValues(iv);
    return iv;
  }
}
