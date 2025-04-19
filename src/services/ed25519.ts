import { base58Decode, base58Encode } from "../utils";
import { getPublicKey, sign, verify } from "../lib/noble-ed25519.js";

export class Ed25519Service {
  /**
   * Derive a Solana public key from a private key
   * @param {string} privateKeyBase58 - Base58-encoded private key
   * @returns {Promise<string>} Base58-encoded public key
   */
  async getPublicKey(privateKeyBase58: string): Promise<string> {
    try {
      const privateKeyBytes = base58Decode(privateKeyBase58);
      const publicKeyBytes = await getPublicKey(privateKeyBytes);
      return base58Encode(publicKeyBytes);
    } catch (error) {
      console.error("Error deriving Solana public key:", error);
      throw error;
    }
  }

  /**
   * Sign a message with a Solana private key using ed25519
   * @param {Uint8Array|string} message - Message to sign (Uint8Array or utf-8 string)
   * @param {string} privateKeyBase58 - Base58-encoded private key
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

      const privateKeyBytes = base58Decode(privateKeyBase58);
      const signatureBytes = await sign(messageBytes, privateKeyBytes);
      return base58Encode(signatureBytes);
    } catch (error) {
      console.error("Error signing with Solana key:", error);
      throw error;
    }
  }

  /**
   * Verify a signature with a Solana public key
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

      return await verify(signatureBytes, messageBytes, publicKeyBytes);
    } catch (error) {
      console.error("Error verifying Solana signature:", error);
      return false;
    }
  }
}
