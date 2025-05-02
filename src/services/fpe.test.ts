import { FPEService } from './fpe';
import type { EncryptionService } from './encryption';
import { mock } from 'vitest-mock-extended';

describe('FPEService', () => {
  let fpeService: FPEService;
  let input: number[];
  const encryptionServiceMock = mock<EncryptionService>();
  // const key = new Uint8Array([
  //   156, 161, 238, 80, 84, 230, 40, 147, 212, 166, 85, 71, 189, 19, 216, 222, 239, 239, 247, 244,
  //   254, 223, 161, 182, 178, 156, 92, 134, 113, 32, 54, 74,
  // ]);
  const key = new Uint8Array([
    112, 105, 70, 134, 182, 201, 2, 79, 163, 230, 51, 84, 242, 105, 138, 10, 214, 195, 186, 219, 90,
    157, 132, 181, 18, 34, 253, 157, 17, 29, 46, 107,
  ]);

  beforeEach(() => {
    input = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10));
    encryptionServiceMock.getAES256EncryptionKey.mockResolvedValue(key);
    fpeService = new FPEService(encryptionServiceMock);
  });

  describe('encrypt-decrypt', () => {
    it('should encrypt  and decrypt a number array', async () => {
      const encrypted = await fpeService.encrypt(input);
      const decrypted = await fpeService.decrypt(encrypted);
      expect(decrypted).toEqual(input);
    });

    // Skipped due to performance, but can be run manually if needed
    it(
      'exhaustive operational check',
      async () => {
        for (let i = 0; i < 100000; i++) {
          const digits = i.toString().padStart(6, '0').split('').map(Number);
          const encrypted = await fpeService.encrypt(digits);
          const decrypted = await fpeService.decrypt(encrypted);
          expect(encrypted.some(d => d < 0 || d >= 10)).toBe(false);
          expect(decrypted).toEqual(digits);
        }
      },
      10 * 60 * 1000
    );
  });
});
