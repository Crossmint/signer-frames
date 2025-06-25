import { CrossmintFrameService } from '../service';
import type { EncryptionService } from './encryption';
import { FPE, type FPEOptions } from './lib';

export class FPEService extends CrossmintFrameService {
  name = 'Format Preserving Encryption Service';
  log_prefix = '[FPEService]';
  private fpe: FPE | null = null;

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly options: FPEOptions = {
      radix: 10,
    }
  ) {
    super();
  }

  public async init(): Promise<void> {
    try {
      this.encryptionService.assertInitialized();
    } catch (error) {
      throw new Error('EncryptionService should be initialized before initializing FPEService');
    }
    const encryptionKey = await this.encryptionService.getAES256EncryptionKey();
    this.fpe = new FPE(encryptionKey, this.options);
  }

  public async encrypt(data: number[]): Promise<number[]> {
    this.assertInitialized();
    const fpe = this.fpe as NonNullable<typeof this.fpe>;
    return fpe.encrypt(data);
  }

  public async decrypt(data: number[]): Promise<number[]> {
    this.assertInitialized();
    const fpe = this.fpe as NonNullable<typeof this.fpe>;
    return fpe.decrypt(data);
  }

  private assertInitialized() {
    if (!this.fpe) {
      throw new Error('FPEService not initialized');
    }
  }
}
