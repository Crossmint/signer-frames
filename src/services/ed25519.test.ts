import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Ed25519Service } from './ed25519';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

describe('Ed25519Service', () => {
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
    it('should derive a public key from a 64-byte Solana private key', async () => {
      const result = await ed25519Service.getPublicKey(PRIVATE_KEY_BASE58);
      const resultBytes = bs58.decode(result);

      const expectedPublicKey = PRIVATE_KEY_BYTES.slice(32, 64);

      expect(resultBytes).toEqual(expectedPublicKey);
    });

    it('should derive a public key from a 32-byte private key', async () => {
      const result = await ed25519Service.getPublicKey(SHORT_PRIVATE_KEY_BASE58);
      const resultBytes = bs58.decode(result);

      expect(resultBytes.length).toBe(32);
    });

    it('should throw an error for invalid key length', async () => {
      const invalidKey = new Uint8Array(20);
      const invalidKeyBase58 = bs58.encode(invalidKey);

      await expect(ed25519Service.getPublicKey(invalidKeyBase58)).rejects.toThrow(
        'Invalid key length: 20. Expected 32 or 64 bytes.'
      );
    });

    it('should log errors that occur during key operations', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const invalidKeyBase58 = 'not-a-valid-base58-key-!@#';

      try {
        await ed25519Service.getPublicKey(invalidKeyBase58);
        expect(true).toBe(false);
      } catch (_e) {
        expect(consoleSpy).toHaveBeenCalled();
      }

      consoleSpy.mockRestore();
    });
  });

  describe('sign', () => {
    it('should sign a message with a private key (string input)', async () => {
      const signature = await ed25519Service.sign(MESSAGE_BYTES, PRIVATE_KEY_BASE58);

      const isValid = await ed25519Service.verifySignature(
        MESSAGE_BYTES,
        signature,
        PUBLIC_KEY_BASE58
      );

      expect(isValid).toBe(true);
    });

    it('should sign a message with a private key (Uint8Array input)', async () => {
      const signature = await ed25519Service.sign(MESSAGE_BYTES, PRIVATE_KEY_BASE58);

      const isValid = await ed25519Service.verifySignature(
        MESSAGE_BYTES,
        signature,
        PUBLIC_KEY_BASE58
      );

      expect(isValid).toBe(true);
    });

    it('should sign a message with a 32-byte key', async () => {
      const publicKey = await ed25519Service.getPublicKey(SHORT_PRIVATE_KEY_BASE58);

      const signature = await ed25519Service.sign(MESSAGE_BYTES, SHORT_PRIVATE_KEY_BASE58);

      const isValid = await ed25519Service.verifySignature(MESSAGE_BYTES, signature, publicKey);

      expect(isValid).toBe(true);
    });

    it('should throw an error for invalid private key length', async () => {
      const invalidKey = new Uint8Array(40);
      const invalidKeyBase58 = bs58.encode(invalidKey);

      await expect(ed25519Service.sign(MESSAGE_BYTES, invalidKeyBase58)).rejects.toThrow(
        'Invalid private key length'
      );
    });

    it('should log errors that occur during signing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const invalidSignatureKey = 'not-a-valid-base58-key-!@#';

      try {
        await ed25519Service.sign(MESSAGE, invalidSignatureKey);
        expect(true).toBe(false);
      } catch (_e) {
        expect(consoleSpy).toHaveBeenCalled();
      }

      consoleSpy.mockRestore();
    });
  });

  describe('verifySignature', () => {
    it('should verify a valid signature with a public key (string message)', async () => {
      const signature = await ed25519Service.sign(MESSAGE_BYTES, PRIVATE_KEY_BASE58);

      const result = await ed25519Service.verifySignature(
        MESSAGE_BYTES,
        signature,
        PUBLIC_KEY_BASE58
      );

      expect(result).toBe(true);
    });

    it('should verify a valid signature with a public key (Uint8Array message)', async () => {
      const signature = await ed25519Service.sign(MESSAGE_BYTES, PRIVATE_KEY_BASE58);

      const result = await ed25519Service.verifySignature(
        MESSAGE_BYTES,
        signature,
        PUBLIC_KEY_BASE58
      );

      expect(result).toBe(true);
    });

    it('should return false for an invalid signature', async () => {
      const differentKeypair = Keypair.generate();
      const differentPublicKey = bs58.encode(new Uint8Array(differentKeypair.publicKey.toBytes()));

      const signature = await ed25519Service.sign(MESSAGE_BYTES, PRIVATE_KEY_BASE58);

      const result = await ed25519Service.verifySignature(
        MESSAGE_BYTES,
        signature,
        differentPublicKey
      );

      expect(result).toBe(false);
    });

    it('should return false for a fabricated signature', async () => {
      const fakeSignature = bs58.encode(new Uint8Array(64).fill(0));

      const result = await ed25519Service.verifySignature(
        MESSAGE_BYTES,
        fakeSignature,
        PUBLIC_KEY_BASE58
      );

      expect(result).toBe(false);
    });

    it('should return false for an invalid public key length', async () => {
      const signature = await ed25519Service.sign(MESSAGE_BYTES, PRIVATE_KEY_BASE58);

      const invalidPublicKey = new Uint8Array(20);
      const invalidPublicKeyBase58 = bs58.encode(invalidPublicKey);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ed25519Service.verifySignature(
        MESSAGE_BYTES,
        signature,
        invalidPublicKeyBase58
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid public key length'));

      consoleSpy.mockRestore();
    });

    it('should handle errors during verification', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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

    it('should match the tweetnacl implementation', async () => {
      const secretKey = await ed25519Service.secretKeyFromSeed(PRIVATE_KEY_BYTES);
      const signature = await ed25519Service.sign(MESSAGE_BYTES, secretKey);
      const naclSignature = nacl.sign.detached(MESSAGE_BYTES, secretKey);
      expect(signature).toEqual(naclSignature);
      expect(nacl.sign.detached.verify(MESSAGE_BYTES, signature, secretKey.slice(32))).toBe(true);
    });
  });

  describe('getSecretKey', () => {
    it('should return a secret key from a secret key and public key', () => {
      const kp = Keypair.generate();
      const secretKey = ed25519Service.getSecretKey(kp.secretKey, kp.publicKey.toBytes());

      expect(secretKey.length).toBe(64);
      expect(secretKey).toEqual(kp.secretKey);
    });
    it('should return a secret key from a private key and public key (base58)', () => {
      const kp = Keypair.generate();
      const secretKey = ed25519Service.getSecretKey(
        kp.secretKey.slice(0, 32),
        kp.publicKey.toBytes()
      );
      expect(secretKey.length).toBe(64);
      expect(secretKey).toEqual(kp.secretKey);
    });
  });

  describe('secretKeyFromSeed', () => {
    it('should return a secret key from a seed', async () => {
      const secretKey = await ed25519Service.secretKeyFromSeed(PRIVATE_KEY_BYTES);
      expect(secretKey.length).toBe(64);
      expect(secretKey).toEqual(PRIVATE_KEY_BYTES);
    });

    it('should only consider the first 32 bytes of the seed', async () => {
      const seed = crypto.getRandomValues(new Uint8Array(64));
      const secretKey = await ed25519Service.secretKeyFromSeed(seed);
      seed[32] = seed[32] + 1;
      const secretKey2 = await ed25519Service.secretKeyFromSeed(seed);
      expect(secretKey.length).toBe(64);
      expect(secretKey).toEqual(secretKey2);
    });

    it('should throw an error if the seed is less than 32 bytes', async () => {
      const seed = crypto.getRandomValues(new Uint8Array(31));
      await expect(ed25519Service.secretKeyFromSeed(seed)).rejects.toThrow(
        'Invalid seed length: 31. Expected at least 32 bytes.'
      );
    });

    it('should return different secret keys for different seeds', async () => {
      const seed1 = crypto.getRandomValues(new Uint8Array(32));
      const seed2 = crypto.getRandomValues(new Uint8Array(32));
      const secretKey1 = await ed25519Service.secretKeyFromSeed(seed1);
      const secretKey2 = await ed25519Service.secretKeyFromSeed(seed2);
      expect(secretKey1).not.toEqual(secretKey2);
    });

    it('should cave compatible behavior with solana-web3.js', async () => {
      const randomSeed = crypto.getRandomValues(new Uint8Array(32));
      const secretKeySolana = await Keypair.fromSeed(randomSeed);
      const secretKeyNoble = await ed25519Service.secretKeyFromSeed(randomSeed);
      expect(secretKeySolana.secretKey).toEqual(secretKeyNoble);
    });
  });
});
