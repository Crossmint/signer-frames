import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Ed25519Service } from './ed25519';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as ed from '../lib/noble-ed25519';

describe('Ed25519Service', () => {
  // Test keys and values that will be used throughout tests
  const solanaKeypair = Keypair.generate();
  const PRIVATE_KEY_BYTES = solanaKeypair.secretKey;
  const PRIVATE_KEY_BASE58 = bs58.encode(PRIVATE_KEY_BYTES);
  const PUBLIC_KEY_BYTES = new Uint8Array(solanaKeypair.publicKey.toBytes());
  const PUBLIC_KEY_BASE58 = bs58.encode(PUBLIC_KEY_BYTES);
  const SHORT_PRIVATE_KEY_BYTES = PRIVATE_KEY_BYTES.slice(0, 32);
  const SHORT_PRIVATE_KEY_BASE58 = bs58.encode(SHORT_PRIVATE_KEY_BYTES);
  const MESSAGE = 'Hello, world!';
  const MESSAGE_BYTES = new TextEncoder().encode(MESSAGE);

  let ed25519Service: Ed25519Service;

  beforeEach(() => {
    ed25519Service = new Ed25519Service();
    vi.clearAllMocks();
  });

  describe('getPublicKey', () => {
    it('should derive public keys from different key formats correctly', async () => {
      // Test with 64-byte Solana private key
      const result64 = await ed25519Service.getPublicKey(PRIVATE_KEY_BASE58);
      const result64Bytes = bs58.decode(result64);
      expect(result64Bytes).toEqual(PRIVATE_KEY_BYTES.slice(32, 64));

      // Test with 32-byte private key
      const result32 = await ed25519Service.getPublicKey(SHORT_PRIVATE_KEY_BASE58);
      const result32Bytes = bs58.decode(result32);
      expect(result32Bytes.length).toBe(32);
    });

    it('should handle errors appropriately', async () => {
      // Test invalid key length
      const invalidKey = new Uint8Array(20);
      const invalidKeyBase58 = bs58.encode(invalidKey);
      await expect(ed25519Service.getPublicKey(invalidKeyBase58)).rejects.toThrow(
        'Invalid key length: 20. Expected 32 or 64 bytes.'
      );

      // Test invalid base58 input
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        await ed25519Service.getPublicKey('not-a-valid-base58-key-!@#');
        expect(true).toBe(false); // Should not reach here
      } catch {
        expect(consoleSpy).toHaveBeenCalled();
      }
      consoleSpy.mockRestore();
    });
  });

  describe('sign and verify signatures', () => {
    it('should sign messages and verify them correctly', async () => {
      // Sign with 64-byte key
      const signature64 = await ed25519Service.sign(MESSAGE_BYTES, PRIVATE_KEY_BASE58);
      const isValid64 = await ed.verifyAsync(
        signature64,
        MESSAGE_BYTES,
        bs58.decode(PUBLIC_KEY_BASE58)
      );
      expect(isValid64).toBe(true);

      // Sign with 32-byte key
      const publicKey32 = await ed25519Service.getPublicKey(SHORT_PRIVATE_KEY_BASE58);
      const signature32 = await ed25519Service.sign(MESSAGE_BYTES, SHORT_PRIVATE_KEY_BASE58);
      const isValid32 = await ed.verifyAsync(signature32, MESSAGE_BYTES, bs58.decode(publicKey32));
      expect(isValid32).toBe(true);
    });

    it('should handle signature verification failures', async () => {
      const signature = await ed25519Service.sign(MESSAGE_BYTES, PRIVATE_KEY_BASE58);

      // Test different public key
      const differentKeypair = Keypair.generate();
      const differentPublicKey = bs58.encode(new Uint8Array(differentKeypair.publicKey.toBytes()));
      const wrongKeyResult = await ed.verifyAsync(
        signature,
        MESSAGE_BYTES,
        bs58.decode(differentPublicKey)
      );
      expect(wrongKeyResult).toBe(false);

      // Test fabricated signature
      const fakeSignature = bs58.encode(new Uint8Array(64).fill(0));
      const fakeResult = await ed.verifyAsync(
        bs58.decode(fakeSignature),
        MESSAGE_BYTES,
        bs58.decode(PUBLIC_KEY_BASE58)
      );
      expect(fakeResult).toBe(false);

      // Test invalid public key length
      const invalidPublicKey = bs58.encode(new Uint8Array(20));
      try {
        const invalidKeyResult = await ed.verifyAsync(
          signature,
          MESSAGE_BYTES,
          bs58.decode(invalidPublicKey)
        );
        expect(invalidKeyResult).toBe(false);
      } catch (error) {
        // Noble-ed25519 throws on invalid key length, which is expected
        expect(error).toBeDefined();
      }
    });

    it('should handle errors during signing and verification', async () => {
      // Test invalid private key length for signing
      const invalidKey = bs58.encode(new Uint8Array(40));
      await expect(ed25519Service.sign(MESSAGE_BYTES, invalidKey)).rejects.toThrow(
        'Invalid private key length'
      );

      // Test error handling during signing
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        await ed25519Service.sign(MESSAGE, 'not-a-valid-base58-key-!@#');
        expect(true).toBe(false); // Should not reach here
      } catch {
        expect(consoleSpy).toHaveBeenCalled();
      }

      // Test error handling during verification
      try {
        const verifyResult = await ed.verifyAsync(
          bs58.decode('not-a-valid-base58-signature-!@#'),
          MESSAGE,
          bs58.decode(PUBLIC_KEY_BASE58)
        );
        expect(verifyResult).toBe(false);
      } catch (error) {
        // Noble-ed25519 may throw on invalid signature format, which is expected
        expect(error).toBeDefined();
      }
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('key utilities', () => {
    it('should create secret keys from seed correctly', async () => {
      // Test with full keypair as seed
      const secretKey1 = await ed25519Service.secretKeyFromSeed(PRIVATE_KEY_BYTES);
      expect(secretKey1.length).toBe(64);
      expect(secretKey1).toEqual(PRIVATE_KEY_BYTES);

      // Test with random seed (only uses first 32 bytes)
      const seed = crypto.getRandomValues(new Uint8Array(64));
      const secretKey2 = await ed25519Service.secretKeyFromSeed(seed);
      const secretKey3 = await ed25519Service.secretKeyFromSeed(seed.slice(0, 32));
      expect(secretKey2).toEqual(secretKey3);

      // Test error handling with short seed
      const shortSeed = new Uint8Array(16);
      await expect(ed25519Service.secretKeyFromSeed(shortSeed)).rejects.toThrow(
        'Invalid seed length: 16. Expected at least 32 bytes.'
      );
    });
  });

  it('should initialize without errors', async () => {
    await expect(ed25519Service.init()).resolves.not.toThrow();
  });
});
