import type { KeyPairProvider, PublicKeyProvider, SymmetricKeyProvider } from './provider';

export class ECDHKeyProvider implements SymmetricKeyProvider {
  constructor(
    private readonly keyPairProvider: KeyPairProvider,
    private readonly publicKeyProvider: PublicKeyProvider
  ) {}

  async getSymmetricKey(): Promise<CryptoKey> {
    const publicKey = await this.publicKeyProvider.getPublicKey();
    const keyPair = await this.keyPairProvider.getKeyPair();

    const symmetricKey = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: publicKey,
      },
      keyPair.privateKey,
      {
        name: 'AES-GCM' as const,
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );

    return symmetricKey;
  }
}
