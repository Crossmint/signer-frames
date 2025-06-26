import { SymmetricKeyProvider } from './provider';

const IV_LENGTH = 12;

export class SymmetricEncryptionHandler {
  constructor(
    private readonly keyProvider: SymmetricKeyProvider,
    private readonly algorithm = 'AES-GCM'
  ) {}

  async encrypt(data: Uint8Array): Promise<Uint8Array> {
    const key = await this.keyProvider.getSymmetricKey();
    const iv = await this.getIv();
    const encrypted = await crypto.subtle.encrypt({ name: this.algorithm, iv }, key, data);
    const ciphertext = new Uint8Array(iv.byteLength + encrypted.byteLength);
    ciphertext.set(iv, 0);
    ciphertext.set(new Uint8Array(encrypted), iv.byteLength);
    return ciphertext;
  }

  async decrypt(extendedCiphertext: Uint8Array): Promise<Uint8Array> {
    console.log('Decrypting data');
    console.log('Extended ciphertext', extendedCiphertext);
    const iv = extendedCiphertext.slice(0, IV_LENGTH);
    console.log('IV', iv);
    const ciphertext = extendedCiphertext.slice(IV_LENGTH);
    console.log('Ciphertext', ciphertext);
    const key = await this.keyProvider.getSymmetricKey();
    console.log('Key', key);
    const decrypted = await crypto.subtle.decrypt({ name: this.algorithm, iv }, key, ciphertext);
    return new Uint8Array(decrypted);
  }

  private async getIv(): Promise<Uint8Array> {
    const iv = new Uint8Array(IV_LENGTH);
    await crypto.getRandomValues(iv);
    return iv;
  }
}
