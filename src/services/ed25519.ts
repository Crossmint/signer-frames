import * as ed from '@noble/ed25519';
import bs58 from 'bs58';

export class Ed25519Service {
  /**
   * Derive a Solana public key from a private key
   * @param {string} privateKeyBase58 - Base58-encoded private key (64 bytes Solana format)
   * @returns {Promise<string>} Base58-encoded public key
   */
  async getPublicKey(privateKeyBase58orArray: string | Uint8Array): Promise<string> {
    try {
      const keyBytes =
        typeof privateKeyBase58orArray === 'string'
          ? bs58.decode(privateKeyBase58orArray)
          : privateKeyBase58orArray;

      // Solana keypairs are 64 bytes: first 32 bytes are the private key, last 32 bytes are the public key
      if (keyBytes.length === 64) {
        // Return the public key portion directly
        return bs58.encode(keyBytes.slice(32, 64));
      }

      if (keyBytes.length === 32) {
        // If it's already a 32-byte private key, derive the public key
        const publicKeyBytes = await ed.getPublicKey(keyBytes);
        return bs58.encode(publicKeyBytes);
      }

      throw new Error(`Invalid key length: ${keyBytes.length}. Expected 32 or 64 bytes.`);
    } catch (error) {
      console.error('Error deriving public key:', error);
      throw error;
    }
  }

  /**
   * Get a secret key from a private key and public key
   * @param {string|Uint8Array} privateKey - Base58-encoded private key (64 bytes Solana format)
   * @param {string|Uint8Array} publicKey - Base58-encoded public key
   * @returns {Uint8Array} Secret key
   */
  getSecretKey(privateKey: string | Uint8Array, publicKey: string | Uint8Array): Uint8Array {
    const privateKeyBytes = typeof privateKey === 'string' ? bs58.decode(privateKey) : privateKey;

    const publicKeyBytes = typeof publicKey === 'string' ? bs58.decode(publicKey) : publicKey;

    return this.concatBytes(privateKeyBytes.slice(0, 32), publicKeyBytes);
  }

  /**
   * Get a secret key from a seed
   * @param {Uint8Array} seed - Seed
   * @returns {Uint8Array} Secret key
   */
  async secretKeyFromSeed(seed: Uint8Array): Promise<Uint8Array> {
    if (seed.length < 32) {
      throw new Error(`Invalid seed length: ${seed.length}. Expected at least 32 bytes.`);
    }
    const trimmedSeed = seed.slice(0, 32);
    const publicKey = await ed.getPublicKey(trimmedSeed);
    return this.concatBytes(trimmedSeed, publicKey);
  }

  /**
   * Sign a message with a private key using ed25519
   * @param {Uint8Array|string} message - Message to sign (Uint8Array or utf-8 string)
   * @param {Uint8Array|string} privateKey - Private key
   * @returns {Promise<Uint8Array>} Signature
   */
  async sign(payload: Uint8Array | string, privateKey: Uint8Array | string): Promise<Uint8Array> {
    try {
      const messageBytes = typeof payload === 'string' ? bs58.decode(payload) : payload;

      const keyBytes = typeof privateKey === 'string' ? bs58.decode(privateKey) : privateKey;

      // Extract the private key portion (first 32 bytes) for Solana keypairs
      let privateKeyBytes: Uint8Array;
      if (keyBytes.length === 32) {
        privateKeyBytes = keyBytes;
      } else if (keyBytes.length === 64) {
        privateKeyBytes = keyBytes.slice(0, 32);
      } else {
        throw new Error(`Invalid private key length: ${keyBytes.length}. Expected 32 bytes.`);
      }

      const signatureBytes = await ed.sign(messageBytes, privateKeyBytes);
      return signatureBytes;
    } catch (error) {
      console.error('Error signing message:', error);
      throw error;
    }
  }

  /**
   * Verify a signature with a public key
   * @param {Uint8Array|string} message - Message that was signed (Uint8Array or utf-8 string)
   * @param {Uint8Array|string} signature - Signature
   * @param {Uint8Array|string} publicKey - Public key
   * @returns {Promise<boolean>} Whether the signature is valid
   */
  async verifySignature(
    payload: Uint8Array | string,
    signature: Uint8Array | string,
    publicKey: Uint8Array | string
  ): Promise<boolean> {
    try {
      // Convert string message to Uint8Array if needed
      const messageBytes = typeof payload === 'string' ? bs58.decode(payload) : payload;

      const signatureBytes = typeof signature === 'string' ? bs58.decode(signature) : signature;

      const publicKeyBytes = typeof publicKey === 'string' ? bs58.decode(publicKey) : publicKey;

      if (publicKeyBytes.length !== 32) {
        console.error(`Invalid public key length: ${publicKeyBytes.length}. Expected 32 bytes.`);
        return false;
      }

      return await ed.verify(signatureBytes, messageBytes, publicKeyBytes);
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  private concatBytes(...arrays: Uint8Array[]): Uint8Array {
    let totalLength = 0;
    for (const arr of arrays) {
      totalLength += arr.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
}
