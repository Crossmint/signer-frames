import { describe, it, expect, beforeEach } from 'vitest';
import { Ed25519Service } from './ed25519';
import { base58Decode, base58Encode } from '../utils';
import { Keypair } from '@solana/web3.js';

describe('Ed25519Service', () => {
  const solanaKeypair = Keypair.generate();
  const PRIVATE_KEY_BYTES = solanaKeypair.secretKey;
  const PRIVATE_KEY_BASE58 = base58Encode(PRIVATE_KEY_BYTES);
  const PUBLIC_KEY_BYTES = new Uint8Array(solanaKeypair.publicKey.toBytes());
  const PUBLIC_KEY_BASE58 = base58Encode(PUBLIC_KEY_BYTES);

  const MESSAGE = 'Hello, world!';
  const MESSAGE_BYTES = new TextEncoder().encode(MESSAGE);

  let ed25519Service: Ed25519Service;

  beforeEach(() => {
    ed25519Service = new Ed25519Service();
  });

  describe('getPublicKey', () => {
    it('should derive a public key from a private key', async () => {
      const result = await ed25519Service.getPublicKey(PRIVATE_KEY_BASE58);
      const resultBytes = base58Decode(result);

      // In Solana keypairs, the public key is the last 32 bytes of the secret key
      const expectedPublicKey = PRIVATE_KEY_BYTES.slice(32, 64);

      // Compare the last 32 bytes since that's what noble-ed25519 uses
      expect(resultBytes).toEqual(expectedPublicKey);
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
  });
});
