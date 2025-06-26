import { AES256_KEY_SPEC } from '../encryption/encryption-consts';
import { KeyPairProvider, PublicKeyProvider, SymmetricKeyProvider } from './provider';

export class SymmetricEncryptionKeyDerivator implements SymmetricKeyProvider {
  constructor(
    private readonly keyPairProvider: KeyPairProvider,
    private readonly publicKeyProvider: PublicKeyProvider
  ) {}

  async getSymmetricKey(): Promise<CryptoKey> {
    const { privateKey } = await this.keyPairProvider.getKeyPair();
    const publicKey = await this.publicKeyProvider.getPublicKey();
    return await crypto.subtle.deriveKey(
      { name: 'ECDH', public: publicKey },
      privateKey,
      AES256_KEY_SPEC,
      true,
      ['decrypt', 'encrypt']
    );
  }
}
