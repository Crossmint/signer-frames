import { FF1 } from '@noble/ciphers/ff1';

export type FPEOptions = {
  radix: number;
  tweak?: Uint8Array;
};

export class FPE {
  private ff1: ReturnType<typeof FF1>;

  constructor(
    key: Uint8Array,
    private readonly options: FPEOptions
  ) {
    this.ff1 = FF1(options.radix, key, options.tweak);
  }

  encrypt(data: number[]): number[] {
    if (data.some(d => d >= this.options.radix)) {
      throw new Error('Data contains values greater than the radix');
    }
    return this.ff1.encrypt(data);
  }

  decrypt(data: number[]): number[] {
    if (data.some(d => d >= this.options.radix)) {
      throw new Error('Data contains values greater than the radix');
    }
    return this.ff1.decrypt(data);
  }
}
