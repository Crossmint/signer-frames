import { CrossmintFrameService } from '../service';
import { FF1 } from '@noble/ciphers/ff1';
import type { EncryptionService, TeePublicKeyProvider } from './encryption';
import { KeyRepository } from '../keys/key-repository';
import { AES256_KEY_SPEC } from './encryption-consts';
type FPEEncryptionOptions = {
  radix: number;
  tweak?: Uint8Array;
};

export class FPEService extends CrossmintFrameService {
  name = 'Format Preserving Encryption Service';
  log_prefix = '[FPEService]';
  private encryptionKey: Uint8Array | null = null;
  private ff1: ReturnType<typeof FF1> | null = null;

  constructor(
    private readonly keyRepository: KeyRepository,
    private readonly recipientPublicKeyProvider: TeePublicKeyProvider,
    private readonly options: FPEEncryptionOptions = {
      radix: 10,
    }
  ) {
    super();
  }

  public async init(): Promise<void> {
    this.encryptionKey = await this.deriveSymmetricEncryptionKey();
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

  /**
   * Returns the raw bytes of the AES256 symmetric key derived from ECDH between iframe and TEE keys.
   *
   * This method exports the raw key material of the symmetric encryption key that was created
   * using Elliptic Curve Diffie-Hellman (ECDH) key exchange between:
   * - **iframe's ephemeral private key** (this client's key pair)
   * - **TEE's attested public key** (hardware-verified public key)
   *
   * The returned raw key bytes can be used for:
   * - Direct symmetric encryption/decryption operations
   * - Key derivation for additional cryptographic operations
   * - Integration with external cryptographic libraries
   *
   * The underlying key was derived via ECDH, ensuring both iframe and TEE can independently
   * compute the same shared secret without network transmission. TEE authenticity is
   * guaranteed by Intel TDX hardware attestation.
   *
   * @returns Promise resolving to Uint8Array containing the raw AES256 key bytes (32 bytes)
   * @throws {Error} When AES256 encryption key has not been initialized
   * @throws {Error} When key export operation fails
   */
  private async deriveSymmetricEncryptionKey() {
    const keyPair = await this.keyRepository.getKeyPair();
    const recipientPublicKey = await this.recipientPublicKeyProvider.getPublicKey();
    const symmetricEncryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: recipientPublicKey,
      },
      keyPair.privateKey,
      AES256_KEY_SPEC,
      true,
      ['decrypt']
    );
    if (!symmetricEncryptionKey) {
      throw new Error('Failed to derive symmetric encryption key');
    }
    return new Uint8Array(await crypto.subtle.exportKey('raw', symmetricEncryptionKey));
  }
}
