import { AES256_KEY_SPEC } from './encryption-consts';
import { KeyPairProvider, PublicKeyProvider } from './provider';

export class SymmetricEncryptionKeyProvider {
  constructor(
    private readonly privateKeyProvider: KeyPairProvider,
    private readonly publicKeyProvider: PublicKeyProvider
  ) {}

  async getKey(): Promise<CryptoKey> {
    const { privateKey } = await this.privateKeyProvider.getKeyPair();
    const publicKey = await this.publicKeyProvider.getPublicKey();
    return await crypto.subtle.deriveKey(
      { name: 'ECDH', public: publicKey },
      privateKey,
      AES256_KEY_SPEC,
      true,
      ['decrypt']
    );
  }
}
