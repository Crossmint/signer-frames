import type { Encoding, KeyType } from '@crossmint/client-signers';

export type Signature<T extends KeyType> = {
  bytes: string;
  encoding: Encoding;
  keyType: T;
};

export type PublicKey<T extends KeyType> = {
  bytes: string;
  encoding: Encoding;
  keyType: T;
};

/**
 * Defines the contract for a cryptographic strategy.
 * Each strategy corresponds to a specific key type (e.g., ed25519, secp256k1)
 * and encapsulates the algorithm-specific logic for key derivation,
 * public key extraction, and signing.
 */
export interface CryptoStrategy<T extends KeyType> {
  readonly keyType: T;

  /**
   * Derives a private key from a given seed.
   *
   * @param seed The seed to derive the private key from.
   * @returns A promise that resolves to the derived private key as a Uint8Array.
   */
  getPrivateKeyFromSeed(seed: Uint8Array): Promise<Uint8Array>;

  /**
   * Derives a public key from a given private key.
   *
   * @param privateKey The private key.
   * @returns A promise that resolves to the derived public key as a Uint8Array.
   */
  getPublicKey(privateKey: Uint8Array): Promise<Uint8Array>;

  /**
   * Signs a message with a given private key. This method is responsible
   * for any necessary hashing of the message before signing.
   *
   * @param privateKey The private key to sign with.
   * @param message The message to sign.
   * @returns A promise that resolves to the raw signature as a Uint8Array.
   */
  sign(privateKey: Uint8Array, payload: Uint8Array): Promise<Uint8Array>;

  /**
   * Formats a public key into its standard string representation.
   *
   * @param publicKey The public key to format.
   * @returns An object containing the encoded string and the encoding type.
   */
  formatPublicKey(publicKey: Uint8Array): { bytes: string; encoding: Encoding };

  /**
   * Formats a signature into its standard string representation.
   *
   * @param signature The signature to format.
   * @returns An object containing the encoded string and the encoding type.
   */
  formatSignature(signature: Uint8Array): Signature<T>;
}
