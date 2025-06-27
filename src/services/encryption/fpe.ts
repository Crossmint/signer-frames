import { CrossmintFrameService } from '../service';
import { FPE } from './lib';
import { KeyPairProvider, PublicKeyProvider } from './lib/providers';
import { deriveSymmetricKey } from './lib/primitives/keys';

export class FPEService extends CrossmintFrameService {
  name = 'Format Preserving Encryption Service';
  log_prefix = '[FPEService]';

  constructor(
    private readonly encryptionKeyProvider: KeyPairProvider,
    private readonly teeKeyProvider: PublicKeyProvider,
    private readonly fpeHandler: FPE = new FPE()
  ) {
    super();
  }

  async init(): Promise<void> {}

  async encrypt(data: number[]): Promise<number[]> {
    return this.fpeHandler.encrypt(data, await this.getEncryptionKey());
  }

  async decrypt(data: number[]): Promise<number[]> {
    return this.fpeHandler.decrypt(data, await this.getEncryptionKey());
  }

  private async getEncryptionKey(): Promise<CryptoKey> {
    const keyPair = await this.encryptionKeyProvider.getKeyPair();
    const publicKey = await this.teeKeyProvider.getPublicKey();
    return deriveSymmetricKey(keyPair.privateKey, publicKey);
  }
}
