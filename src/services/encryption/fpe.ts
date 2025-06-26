import { CrossmintFrameService } from '../service';
import { FF1 } from '@noble/ciphers/ff1';
import { FPEHandler } from './lib/encryption/symmetric/fpe/fpe';
import { SymmetricKeyProvider } from './lib/key-management/provider';
type FPEEncryptionOptions = {
  radix: number;
  tweak?: Uint8Array;
};

export class FPEService extends CrossmintFrameService {
  name = 'Format Preserving Encryption Service';
  log_prefix = '[FPEService]';

  constructor(
    private readonly encryptionKeyProvider: SymmetricKeyProvider,
    private readonly fpeHandler: FPEHandler = new FPEHandler()
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
    return this.encryptionKeyProvider.getSymmetricKey();
  }
}
