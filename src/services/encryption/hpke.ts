import { CrossmintFrameService } from '../service';
import { KeyPairProvider, type EncryptionResult } from '@crossmint/client-signers-cryptography';
import { HPKE } from '@crossmint/client-signers-cryptography';

/**
 * Represents data that can be encrypted by the HPKE service.
 * Typically used for structured data like OTP verification payloads.
 */
type EncryptablePayload = Record<string, unknown>;

/**
 * Provider interface for retrieving public keys used in HPKE operations.
 * Implementations should provide the TEE's attested public key for secure communication.
 */
interface PublicKeyProvider {
  /**
   * Retrieves the public key for HPKE encryption/decryption operations.
   * @returns Promise that resolves to the public key
   */
  getPublicKey(): Promise<CryptoKey>;
}

/**
 * HPKE (Hybrid Public Key Encryption) service for secure communication with Trusted Execution Environment (TEE).
 *
 * This service provides end-to-end encryption for sensitive communications, particularly:
 * - Encrypting decrypted OTP codes before sending them to the TEE for verification
 * - Securing user authentication data during the sign-in process
 * - Protecting sensitive user data in transit to/from the attested TEE
 *
 * The service uses HPKE base mode for client-to-TEE communication (no sender authentication needed)
 * and HPKE auth mode for TEE-to-client communication (cryptographic sender verification).
 *
 * Key security features:
 * - Hardware-attested TEE public key ensures authentic recipient
 * - HPKE provides forward secrecy and post-quantum security
 * - Prevents man-in-the-middle attacks on sensitive data like OTPs
 *
 * @example
 * ```typescript
 * const hpkeService = new HPKEService(encryptionKeyProvider, teePublicKeyProvider);
 * await hpkeService.init();
 *
 * // Encrypt OTP for TEE verification
 * const otpPayload = { otp: "123456", timestamp: Date.now() };
 * const encrypted = await hpkeService.encrypt(otpPayload);
 * ```
 */
export class HPKEService extends CrossmintFrameService {
  name = 'HPKE Service';
  log_prefix = '[HPKEService]';

  /**
   * Creates a new HPKE service instance.
   *
   * @param masterFrameKeyPairProvider - Provider for client-side encryption key pairs
   * @param teePublicKeyProvider - Provider for TEE's attested public key
   * @param hkpe - HPKE implementation instance (defaults to new HPKE())
   */
  constructor(
    private readonly masterFrameKeyProvider: KeyPairProvider,
    private readonly teePublicKeyProvider: PublicKeyProvider,
    private readonly hkpe: HPKE = new HPKE()
  ) {
    super();
  }

  /**
   * Initializes the HPKE service by validating the TEE public key.
   *
   * This method should be called before using any encryption/decryption operations
   * to ensure the TEE public key is accessible and valid.
   *
   * @throws {Error} When TEE public key cannot be retrieved or is invalid
   */
  async init(): Promise<void> {
    try {
      // The init method can be used to pre-fetch or validate the TEE public key
      await this.teePublicKeyProvider.getPublicKey();
    } catch (error) {
      this.logError(`Initialization failed: ${error}`);
      throw new Error('Encryption initialization failed');
    }
  }

  /**
   * Encrypts structured data for transmission TO the attested TEE.
   *
   * Primary use case: Encrypting decrypted OTP codes and authentication data
   * before sending them to the TEE for verification. This ensures that sensitive
   * authentication information is protected during transit.
   *
   * Uses HPKE base mode - the client acts as sender, TEE as recipient.
   * No sender authentication is needed, user's authenticate their client devices
   * and therefore the sender key, through other means, for example an OTP,
   * This is handled outside the context of HPKE.
   * The TEE's public key authenticity is guaranteed by hardware attestation.
   *
   * @template T - Type of data being encrypted (extends EncryptablePayload)
   * @param data - Data object to encrypt (e.g., OTP verification payload)
   * @returns Promise resolving to encryption result with ciphertext and encapsulated key
   * @throws {Error} When encryption operation fails
   *
   * @example
   * ```typescript
   * // Encrypt OTP for TEE verification
   * const otpData = { otp: "123456", userId: "user123", timestamp: Date.now() };
   * const result = await hpkeService.encrypt(otpData);
   * // Send result.ciphertext and result.encapsulatedKey to TEE
   * ```
   */
  async encrypt<T extends EncryptablePayload>(data: T): Promise<EncryptionResult<ArrayBuffer>> {
    try {
      const recipientPublicKey = await this.teePublicKeyProvider.getPublicKey();
      const senderKeyPair = await this.masterFrameKeyProvider.getKeyPair();
      return await this.hkpe.encrypt(data, recipientPublicKey, senderKeyPair);
    } catch (error) {
      this.logError(`Encryption failed: ${error}`);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Encrypts raw binary data for transmission to the TEE.
   *
   * Used for encrypting binary payloads when structured data encryption is not needed.
   * Provides lower-level encryption for raw data buffers.
   *
   * @param data - Raw binary data to encrypt
   * @returns Promise resolving to encryption result with ciphertext and encapsulated key
   * @throws {Error} When encryption operation fails
   *
   * @example
   * ```typescript
   * const binaryData = new ArrayBuffer(32);
   * const result = await hpkeService.encryptRaw(binaryData);
   * ```
   */
  async encryptRaw(data: ArrayBuffer): Promise<EncryptionResult<ArrayBuffer>> {
    try {
      const recipientPublicKey = await this.teePublicKeyProvider.getPublicKey();
      return await this.hkpe.encryptRaw(data, recipientPublicKey);
    } catch (error) {
      this.logError(`Encryption failed: ${error}`);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Encrypts structured data and returns the result as base64-encoded strings.
   *
   * Convenient method for encrypting data when base64 encoding is preferred
   * for transport or storage. Commonly used for web-based communications.
   *
   * @template T - Type of data being encrypted
   * @param data - Data object to encrypt
   * @returns Promise resolving to encryption result with base64-encoded ciphertext and key
   * @throws {Error} When encryption operation fails
   *
   * @example
   * ```typescript
   * const otpData = { otp: "123456", action: "verify" };
   * const result = await hpkeService.encryptBase64(otpData);
   * // result.ciphertext and result.encapsulatedKey are base64 strings
   * ```
   */
  async encryptBase64<T extends Record<string, unknown>>(
    data: T
  ): Promise<EncryptionResult<string>> {
    try {
      const recipientPublicKey = await this.teePublicKeyProvider.getPublicKey();
      const senderKeyPair = await this.masterFrameKeyProvider.getKeyPair();
      return await this.hkpe.encryptBase64(data, recipientPublicKey, senderKeyPair);
    } catch (error) {
      this.logError(`Encryption failed: ${error}`);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts messages received FROM the attested TEE.
   *
   * Primary use case: Decrypting responses from the TEE after OTP verification
   * or other authentication operations. This ensures that responses are genuinely
   * from the attested TEE and not from an impersonator.
   *
   * Uses HPKE auth mode to cryptographically verify that messages originated
   * from the genuine attested TEE. This prevents impersonation attacks where
   * malicious actors attempt to send fake messages claiming to be from the TEE.
   *
   * The sender verification happens automatically during HPKE decryption - if the
   * message wasn't sent by the expected TEE (attested public key), decryption fails.
   *
   * @template T - Expected type of decrypted data
   * @template U - Type of input data (string or ArrayBuffer)
   * @param ciphertextInput - Encrypted message data from the TEE
   * @param encapsulatedKeyInput - HPKE encapsulated key from the TEE
   * @returns Promise resolving to decrypted data
   * @throws {Error} When decryption operation fails or sender verification fails
   *
   * @example
   * ```typescript
   * // Decrypt TEE response after OTP verification
   * const decrypted = await hpkeService.decrypt<{verified: boolean, token: string}>(
   *   encryptedResponse.ciphertext,
   *   encryptedResponse.encapsulatedKey
   * );
   * console.log(decrypted.verified); // true if OTP was valid
   * ```
   */
  async decrypt<T extends EncryptablePayload, U extends string | ArrayBuffer>(
    ciphertextInput: U,
    encapsulatedKeyInput: U
  ): Promise<T> {
    try {
      const keyPair = await this.masterFrameKeyProvider.getKeyPair();
      const senderPublicKey = await this.teePublicKeyProvider.getPublicKey();
      return await this.hkpe.decrypt(
        ciphertextInput,
        encapsulatedKeyInput,
        keyPair,
        senderPublicKey
      );
    } catch (error) {
      this.logError(`Decryption failed: ${error}`);
      throw new Error('Failed to decrypt data');
    }
  }
}
