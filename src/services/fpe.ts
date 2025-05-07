import { XMIFService } from './service';
import { FF1 } from '@noble/ciphers/ff1';
import type { EncryptionService } from './encryption';
type FPEEncryptionOptions = {
  radix: number;
  tweak?: Uint8Array;
};

export class FPEService extends XMIFService {
  name = 'Format Preserving Encryption Service';
  log_prefix = '[FPEService]';
  private encryptionKey: Uint8Array | null = null;
  private ff1: ReturnType<typeof FF1> | null = null;

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly options: FPEEncryptionOptions = {
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
    this.encryptionKey = await this.encryptionService.getAES256EncryptionKey();
    this.ff1 = FF1(this.options.radix, this.encryptionKey, this.options.tweak);
  }

  public async encrypt(data: number[]): Promise<number[]> {
    if (data.some(d => d >= this.options.radix)) {
      throw new Error('Data contains values greater than the radix');
    }
    this.assertInitialized();
    const ff1 = this.ff1 as NonNullable<typeof this.ff1>;
    return ff1.encrypt(data);
  }

  public async decrypt(data: number[]): Promise<number[]> {
    if (data.some(d => d >= this.options.radix)) {
      throw new Error('Data contains values greater than the radix');
    }
    this.assertInitialized();
    const ff1 = this.ff1 as NonNullable<typeof this.ff1>;
    return ff1.decrypt(data);
  }

  private assertInitialized() {
    if (!this.ff1) {
      throw new Error('FPEService not initialized');
    }
  }
}
