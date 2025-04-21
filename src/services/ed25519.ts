import { base58Decode, base58Encode } from "../utils";
import * as ed from "../lib/noble-ed25519.js";
import { sha512 } from "@noble/hashes/sha512";

// Helper function to concatenate Uint8Arrays
const concatBytes = (...arrays: Uint8Array[]): Uint8Array => {
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
};

// Set up SHA-512 functions required by noble-ed25519
if (ed.etc) {
  ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(concatBytes(...m));
  ed.etc.sha512Async = (...m: Uint8Array[]) =>
    Promise.resolve(sha512(concatBytes(...m)));
}

export class Ed25519Service {
  /**
   * Derive a Solana public key from a private key
   * @param {string} privateKeyBase58 - Base58-encoded private key (64 bytes Solana format)
   * @returns {Promise<string>} Base58-encoded public key
   */
  async getPublicKey(privateKeyBase58: string): Promise<string> {
    try {
      const keyBytes = base58Decode(privateKeyBase58);

      // Solana keypairs are 64 bytes: first 32 bytes are the private key, last 32 bytes are the public key
      if (keyBytes.length === 64) {
        // Return the public key portion directly
        return base58Encode(keyBytes.slice(32, 64));
      }

      if (keyBytes.length === 32) {
        // If it's already a 32-byte private key, derive the public key
        const publicKeyBytes = await ed.getPublicKeyAsync(keyBytes);
        return base58Encode(publicKeyBytes);
      }

      throw new Error(
        `Invalid key length: ${keyBytes.length}. Expected 32 or 64 bytes.`
      );
    } catch (error) {
      console.error("Error deriving public key:", error);
      throw error;
    }
  }

  /**
   * Sign a message with a private key using ed25519
   * @param {Uint8Array|string} message - Message to sign (Uint8Array or utf-8 string)
   * @param {string} privateKeyBase58 - Base58-encoded private key (64 bytes Solana format)
   * @returns {Promise<string>} Base58-encoded signature
   */
  async signMessage(
    message: Uint8Array | string,
    privateKeyBase58: string
  ): Promise<string> {
    try {
      // Convert string message to Uint8Array if needed
      const messageBytes =
        typeof message === "string"
          ? new TextEncoder().encode(message)
          : message;

      const keyBytes = base58Decode(privateKeyBase58);

      // Extract the private key portion (first 32 bytes) for Solana keypairs
      const privateKeyBytes =
        keyBytes.length === 64 ? keyBytes.slice(0, 32) : keyBytes;

      if (privateKeyBytes.length !== 32) {
        throw new Error(
          `Invalid private key length: ${privateKeyBytes.length}. Expected 32 bytes.`
        );
      }

      const signatureBytes = await ed.signAsync(messageBytes, privateKeyBytes);
      return base58Encode(signatureBytes);
    } catch (error) {
      console.error("Error signing message:", error);
      throw error;
    }
  }

  /**
   * Verify a signature with a public key
   * @param {Uint8Array|string} message - Message that was signed (Uint8Array or utf-8 string)
   * @param {string} signatureBase58 - Base58-encoded signature
   * @param {string} publicKeyBase58 - Base58-encoded public key
   * @returns {Promise<boolean>} Whether the signature is valid
   */
  async verifySignature(
    message: Uint8Array | string,
    signatureBase58: string,
    publicKeyBase58: string
  ): Promise<boolean> {
    try {
      // Convert string message to Uint8Array if needed
      const messageBytes =
        typeof message === "string"
          ? new TextEncoder().encode(message)
          : message;

      const signatureBytes = base58Decode(signatureBase58);
      const publicKeyBytes = base58Decode(publicKeyBase58);

      if (publicKeyBytes.length !== 32) {
        console.error(
          `Invalid public key length: ${publicKeyBytes.length}. Expected 32 bytes.`
        );
        return false;
      }

      return await ed.verifyAsync(signatureBytes, messageBytes, publicKeyBytes);
    } catch (error) {
      console.error("Error verifying signature:", error);
      return false;
    }
  }
}
