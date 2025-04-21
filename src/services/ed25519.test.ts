import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Ed25519Service } from './ed25519';
import { base58Decode, base58Encode } from '../utils';
import { Keypair } from '@solana/web3.js';

describe('Ed25519Service', () => {
  const solanaKeypair = Keypair.generate();
  const PRIVATE_KEY_BYTES = solanaKeypair.secretKey;
  const PRIVATE_KEY_BASE58 = base58Encode(PRIVATE_KEY_BYTES);
  const PUBLIC_KEY_BYTES = new Uint8Array(solanaKeypair.publicKey.toBytes());
  const PUBLIC_KEY_BASE58 = base58Encode(PUBLIC_KEY_BYTES);

  // Create a 32-byte private key for testing
  const SHORT_PRIVATE_KEY_BYTES = PRIVATE_KEY_BYTES.slice(0, 32);
  const SHORT_PRIVATE_KEY_BASE58 = base58Encode(SHORT_PRIVATE_KEY_BYTES);

  const MESSAGE = 'Hello, world!';
  const MESSAGE_BYTES = new TextEncoder().encode(MESSAGE);

  let ed25519Service: Ed25519Service;

  beforeEach(() => {
    ed25519Service = new Ed25519Service();
    vi.clearAllMocks();
  });

  describe('getPublicKey', () => {
    it('should derive a public key from a 64-byte Solana private key', async () => {
      const result = await ed25519Service.getPublicKey(PRIVATE_KEY_BASE58);
      const resultBytes = base58Decode(result);

      // In Solana keypairs, the public key is the last 32 bytes of the secret key
      const expectedPublicKey = PRIVATE_KEY_BYTES.slice(32, 64);

      // Compare the last 32 bytes since that's what noble-ed25519 uses
      expect(resultBytes).toEqual(expectedPublicKey);
    });

    it('should derive a public key from a 32-byte private key', async () => {
      const result = await ed25519Service.getPublicKey(SHORT_PRIVATE_KEY_BASE58);
      const resultBytes = base58Decode(result);

      // For a 32-byte key, the ed25519 library derives the public key
      expect(resultBytes.length).toBe(32);
    });

    it('should throw an error for invalid key length', async () => {
      // Create an invalid length key (not 32 or 64 bytes)
      const invalidKey = new Uint8Array(20);
      const invalidKeyBase58 = base58Encode(invalidKey);

      await expect(ed25519Service.getPublicKey(invalidKeyBase58)).rejects.toThrow(
        'Invalid key length: 20. Expected 32 or 64 bytes.'
      );
    });

    it('should log errors that occur during key operations', async () => {
      // Directly spy on console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create an invalid format key that will cause errors during decoding
      const invalidKeyBase58 = 'not-a-valid-base58-key-!@#';

      try {
        await ed25519Service.getPublicKey(invalidKeyBase58);
        // If no error is thrown, fail the test
        expect(true).toBe(false);
      } catch (error) {
        // We expect an error to be thrown and logged
        expect(consoleSpy).toHaveBeenCalled();
      }

      consoleSpy.mockRestore();
    });
  });

  describe('signMessage', () => {
    it('should sign a message with a private key (string input)', async () => {
      const signature = await ed25519Service.signMessage(MESSAGE, PRIVATE_KEY_BASE58);

      // Verify the signature can be verified
      const isValid = await ed25519Service.verifySignature(MESSAGE, signature, PUBLIC_KEY_BASE58);

      expect(isValid).toBe(true);
    });

    it('should sign a message with a private key (Uint8Array input)', async () => {
      const signature = await ed25519Service.signMessage(MESSAGE_BYTES, PRIVATE_KEY_BASE58);

      // Verify the signature can be verified
      const isValid = await ed25519Service.verifySignature(
        MESSAGE_BYTES,
        signature,
        PUBLIC_KEY_BASE58
      );

      expect(isValid).toBe(true);
    });

    it('should sign a message with a 32-byte key', async () => {
      // Get the public key for our 32-byte private key
      const publicKey = await ed25519Service.getPublicKey(SHORT_PRIVATE_KEY_BASE58);

      // Sign with 32-byte key
      const signature = await ed25519Service.signMessage(MESSAGE, SHORT_PRIVATE_KEY_BASE58);

      // Verify signature
      const isValid = await ed25519Service.verifySignature(MESSAGE, signature, publicKey);

      expect(isValid).toBe(true);
    });

    it('should throw an error for invalid private key length', async () => {
      // Create a private key with invalid length (not 32 or 64 bytes)
      const invalidKey = new Uint8Array(40);
      const invalidKeyBase58 = base58Encode(invalidKey);

      await expect(ed25519Service.signMessage(MESSAGE, invalidKeyBase58)).rejects.toThrow(
        'Invalid private key length'
      );
    });

    it('should log errors that occur during signing', async () => {
      // Directly spy on console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create an invalid format key that will cause errors during processing
      const invalidSignatureKey = 'not-a-valid-base58-key-!@#';

      try {
        await ed25519Service.signMessage(MESSAGE, invalidSignatureKey);
        // If no error is thrown, fail the test
        expect(true).toBe(false);
      } catch (error) {
        // We expect an error to be thrown and logged
        expect(consoleSpy).toHaveBeenCalled();
      }

      consoleSpy.mockRestore();
    });
  });

  describe('verifySignature', () => {
    it('should verify a valid signature with a public key (string message)', async () => {
      const signature = await ed25519Service.signMessage(MESSAGE, PRIVATE_KEY_BASE58);

      const result = await ed25519Service.verifySignature(MESSAGE, signature, PUBLIC_KEY_BASE58);

      expect(result).toBe(true);
    });

    it('should verify a valid signature with a public key (Uint8Array message)', async () => {
      const signature = await ed25519Service.signMessage(MESSAGE_BYTES, PRIVATE_KEY_BASE58);

      const result = await ed25519Service.verifySignature(
        MESSAGE_BYTES,
        signature,
        PUBLIC_KEY_BASE58
      );

      expect(result).toBe(true);
    });

    it('should return false for an invalid signature', async () => {
      // Generate a different keypair
      const differentKeypair = Keypair.generate();
      const differentPublicKey = base58Encode(new Uint8Array(differentKeypair.publicKey.toBytes()));

      // Sign with original key
      const signature = await ed25519Service.signMessage(MESSAGE, PRIVATE_KEY_BASE58);

      // Verify with different public key (should fail)
      const result = await ed25519Service.verifySignature(MESSAGE, signature, differentPublicKey);

      expect(result).toBe(false);
    });

    it('should return false for a fabricated signature', async () => {
      // Create a 64-byte fake signature filled with zeros
      const fakeSignature = base58Encode(new Uint8Array(64).fill(0));

      // Try to verify with the fake signature (should fail)
      const result = await ed25519Service.verifySignature(
        MESSAGE,
        fakeSignature,
        PUBLIC_KEY_BASE58
      );

      expect(result).toBe(false);
    });

    it('should return false for an invalid public key length', async () => {
      const signature = await ed25519Service.signMessage(MESSAGE, PRIVATE_KEY_BASE58);

      // Create an invalid public key
      const invalidPublicKey = new Uint8Array(20); // Not 32 bytes
      const invalidPublicKeyBase58 = base58Encode(invalidPublicKey);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ed25519Service.verifySignature(
        MESSAGE,
        signature,
        invalidPublicKeyBase58
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid public key length'));

      consoleSpy.mockRestore();
    });

    it('should handle errors during verification', async () => {
      const signature = await ed25519Service.signMessage(MESSAGE, PRIVATE_KEY_BASE58);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create a scenario that would cause an error (invalid signature format)
      const invalidSignature = 'not-a-valid-base58-signature-!@#';

      const result = await ed25519Service.verifySignature(
        MESSAGE,
        invalidSignature,
        PUBLIC_KEY_BASE58
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
