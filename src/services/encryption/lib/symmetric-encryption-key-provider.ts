import { KeyRepository } from '../../keys/key-repository';
import { CrossmintFrameService } from '../../service';
import { TeePublicKeyProvider } from '../encryption';
import { AES256_KEY_SPEC } from '../encryption-consts';

export class SymmetricEncryptionKeyProvider {
  constructor(
    private readonly privateKeyProvider: KeyRepository,
    private readonly publicKeyProvider: TeePublicKeyProvider
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
