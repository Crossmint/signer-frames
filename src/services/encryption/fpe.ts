import { CrossmintFrameService } from '../service';
import { FPE } from '@crossmint/client-signers-cryptography';
import { KeyPairProvider, PublicKeyProvider } from '@crossmint/client-signers-cryptography';
import { deriveSymmetricKey } from '@crossmint/client-signers-cryptography';

/**
 * Format Preserving Encryption (FPE) service that implements the FF1 NIST-approved algorithm.
 *
 * This service is primarily used for decrypting One-Time Passwords (OTPs) when received from
 * the Trusted Execution Environment (TEE). The FF1 algorithm ensures that encrypted data
 * maintains the same format as the original data, making it ideal for preserving OTP structure.
 *
 * The encryption key is derived using ECDH key agreement between the local key pair and
 * the TEE's public key, ensuring secure communication channel establishment.
 *
 * @extends CrossmintFrameService
 */
export class FPEService extends CrossmintFrameService {
  name = 'Format Preserving Encryption Service';
  log_prefix = '[FPEService]';

  /**
   * Creates a new FPE service instance.
   *
   * @param {KeyPairProvider} frameKeyProvider - Provider for the local frame master key pair
   * @param {PublicKeyProvider} teeKeyProvider - Provider for the TEE's public key
   * @param {FPE} fpe - The FPE handler implementing FF1 algorithm (defaults to new FPE instance)
   */
  constructor(
    private readonly frameKeyProvider: KeyPairProvider,
    private readonly teeKeyProvider: PublicKeyProvider,
    private readonly fpe: FPE = new FPE()
  ) {
    super();
  }

  /**
   * Decrypts data using the FF1 format-preserving encryption algorithm.
   *
   * This method is primarily used to decrypt OTPs received from the TEE while
   * preserving their original numeric format. The encryption key is derived
   * through ECDH key agreement with the TEE.
   *
   * @param {number[]} data - The encrypted data as an array of numbers
   * @returns {Promise<number[]>} A promise that resolves to the decrypted data as an array of numbers
   */
  async decrypt(data: number[]): Promise<number[]> {
    return this.fpe.decrypt(data, await this.getEncryptionKey());
  }

  /**
   * Derives the symmetric encryption key using ECDH key agreement.
   *
   * Combines the local private key with the TEE's public key to create a shared
   * symmetric key for FPE operations. This ensures that only the intended recipient
   * (with access to the corresponding private key) can decrypt the data.
   *
   * @private
   * @returns {Promise<CryptoKey>} A promise that resolves to the derived symmetric encryption key
   */
  private async getEncryptionKey(): Promise<CryptoKey> {
    const keyPair = await this.frameKeyProvider.getKeyPair();
    const publicKey = await this.teeKeyProvider.getPublicKey();
    return deriveSymmetricKey(keyPair.privateKey, publicKey);
  }
}
