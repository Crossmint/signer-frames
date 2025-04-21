import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mock } from "vitest-mock-extended";
import { Ed25519Service } from "./ed25519";
import { base58Decode, base58Encode } from "../utils";
import * as nobleEd25519 from "../lib/noble-ed25519.js";
import { Keypair } from "@solana/web3.js";

// Only mock the noble-ed25519 library
vi.mock("../lib/noble-ed25519.js", () => ({
  getPublicKey: vi.fn(),
  sign: vi.fn(),
  verify: vi.fn(),
}));

describe("Ed25519Service", () => {
  const solanaKeypair = Keypair.generate();
  const PRIVATE_KEY_BYTES = solanaKeypair.secretKey;
  const PRIVATE_KEY_BASE58 = base58Encode(PRIVATE_KEY_BYTES);
  const PUBLIC_KEY_BYTES = new Uint8Array(solanaKeypair.publicKey.toBytes());
  const PUBLIC_KEY_BASE58 = base58Encode(PUBLIC_KEY_BYTES);

  const MESSAGE = "Hello, world!";
  const MESSAGE_BYTES = new TextEncoder().encode(MESSAGE);
  const SIGNATURE_BYTES = new Uint8Array([9, 10, 11, 12]);
  const SIGNATURE_BASE58 = base58Encode(SIGNATURE_BYTES);

  let ed25519Service: Ed25519Service;

  beforeEach(() => {
    vi.clearAllMocks();
    ed25519Service = new Ed25519Service();

    // Setup default mock implementations for noble-ed25519
    (nobleEd25519.getPublicKey as ReturnType<typeof vi.fn>).mockResolvedValue(
      PUBLIC_KEY_BYTES
    );
    (nobleEd25519.sign as ReturnType<typeof vi.fn>).mockResolvedValue(
      SIGNATURE_BYTES
    );
    (nobleEd25519.verify as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPublicKey", () => {
    it("should derive a public key from a private key", async () => {
      // Execute
      const result = await ed25519Service.getPublicKey(PRIVATE_KEY_BASE58);

      // Verify
      expect(nobleEd25519.getPublicKey).toHaveBeenCalledWith(
        expect.any(Uint8Array)
      );
      expect(result).toBe(PUBLIC_KEY_BASE58);
    });

    it("should throw an error if derivation fails", async () => {
      // Setup
      const mockError = new Error("Derivation failed");
      (nobleEd25519.getPublicKey as ReturnType<typeof vi.fn>).mockRejectedValue(
        mockError
      );

      // Execute and verify
      await expect(
        ed25519Service.getPublicKey(PRIVATE_KEY_BASE58)
      ).rejects.toThrow(mockError);
    });
  });

  describe("signMessage", () => {
    it("should sign a message with a private key (string input)", async () => {
      // Execute
      const result = await ed25519Service.signMessage(
        MESSAGE,
        PRIVATE_KEY_BASE58
      );

      // Verify
      expect(nobleEd25519.sign).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.any(Uint8Array)
      );
      expect(result).toBe(SIGNATURE_BASE58);

      // Verify the message was properly encoded
      const signCall = (nobleEd25519.sign as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const messageArg = signCall[0];
      expect(messageArg).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(messageArg)).toBe(MESSAGE);
    });

    it("should sign a message with a private key (Uint8Array input)", async () => {
      // Execute
      const result = await ed25519Service.signMessage(
        MESSAGE_BYTES,
        PRIVATE_KEY_BASE58
      );

      // Verify
      expect(nobleEd25519.sign).toHaveBeenCalledWith(
        MESSAGE_BYTES,
        expect.any(Uint8Array)
      );
      expect(result).toBe(SIGNATURE_BASE58);
    });

    it("should throw an error if signing fails", async () => {
      // Setup
      const mockError = new Error("Signing failed");
      (nobleEd25519.sign as ReturnType<typeof vi.fn>).mockRejectedValue(
        mockError
      );

      // Execute and verify
      await expect(
        ed25519Service.signMessage(MESSAGE, PRIVATE_KEY_BASE58)
      ).rejects.toThrow(mockError);
    });
  });

  describe("verifySignature", () => {
    it("should verify a signature with a public key (string message)", async () => {
      // Execute
      const result = await ed25519Service.verifySignature(
        MESSAGE,
        SIGNATURE_BASE58,
        PUBLIC_KEY_BASE58
      );

      // Verify
      expect(nobleEd25519.verify).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.any(Uint8Array),
        expect.any(Uint8Array)
      );
      expect(result).toBe(true);

      // Verify the message was properly encoded
      const verifyCall = (nobleEd25519.verify as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const messageArg = verifyCall[1];
      expect(messageArg).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(messageArg)).toBe(MESSAGE);
    });

    it("should verify a signature with a public key (Uint8Array message)", async () => {
      // Execute
      const result = await ed25519Service.verifySignature(
        MESSAGE_BYTES,
        SIGNATURE_BASE58,
        PUBLIC_KEY_BASE58
      );

      // Verify
      expect(nobleEd25519.verify).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        MESSAGE_BYTES,
        expect.any(Uint8Array)
      );
      expect(result).toBe(true);
    });

    it("should return false if verification fails", async () => {
      // Setup
      (nobleEd25519.verify as ReturnType<typeof vi.fn>).mockResolvedValue(
        false
      );

      // Execute
      const result = await ed25519Service.verifySignature(
        MESSAGE,
        SIGNATURE_BASE58,
        PUBLIC_KEY_BASE58
      );

      // Verify
      expect(result).toBe(false);
    });

    it("should return false if an error occurs during verification", async () => {
      // Setup
      (nobleEd25519.verify as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Verification error")
      );

      // Execute
      const result = await ed25519Service.verifySignature(
        MESSAGE,
        SIGNATURE_BASE58,
        PUBLIC_KEY_BASE58
      );

      // Verify
      expect(result).toBe(false);
    });
  });
});
