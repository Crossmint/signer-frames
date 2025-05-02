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

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly options: FPEEncryptionOptions = {
      radix: 10,
    }
  ) {
    super();
  }

  public async encrypt(data: number[]): Promise<number[]> {
    if (data.some(d => d >= this.options.radix)) {
      throw new Error('Data contains values greater than the radix');
    }
    const key = await this.encryptionService.getAES256EncryptionKey();
    const ff1 = FF1(this.options.radix, key, this.options.tweak);
    return ff1.encrypt(data);
  }

  public async decrypt(data: number[]): Promise<number[]> {
    if (data.some(d => d >= this.options.radix)) {
      throw new Error('Data contains values greater than the radix');
    }
    const key = await this.encryptionService.getAES256EncryptionKey();
    const ff1 = FF1(this.options.radix, key, this.options.tweak);
    return ff1.decrypt(data);
  }
}
