import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { Ed25519Service } from "./ed25519";
import { base58Decode, base58Encode } from "../utils";
import { Keypair } from "@solana/web3.js";

// Mock the noble-ed25519 library - must be before any imports of the library
vi.mock("../lib/noble-ed25519.js", () => {
  return {
    getPublicKey: vi.fn(),
    sign: vi.fn(),
    verify: vi.fn(),
  };
});

// Import the mocked module after mocking
import * as nobleEd25519 from "../lib/noble-ed25519.js";

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

    // Reset and set default mock implementations
    vi.mocked(nobleEd25519.getPublicKey).mockReset();
    vi.mocked(nobleEd25519.sign).mockReset();
    vi.mocked(nobleEd25519.verify).mockReset();

    vi.mocked(nobleEd25519.getPublicKey).mockResolvedValue(PUBLIC_KEY_BYTES);
    vi.mocked(nobleEd25519.sign).mockResolvedValue(SIGNATURE_BYTES);
    vi.mocked(nobleEd25519.verify).mockResolvedValue(true);

    ed25519Service = new Ed25519Service();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPublicKey", () => {
    it("should derive a public key from a private key", async () => {
      const result = await ed25519Service.getPublicKey(PRIVATE_KEY_BASE58);

      expect(nobleEd25519.getPublicKey).toHaveBeenCalledWith(
        expect.any(Uint8Array)
      );
      expect(result).toBe(PUBLIC_KEY_BASE58);
    });

    it("should throw an error if derivation fails", async () => {
      const mockError = new Error("Derivation failed");
      vi.mocked(nobleEd25519.getPublicKey).mockRejectedValueOnce(mockError);

      await expect(
        ed25519Service.getPublicKey(PRIVATE_KEY_BASE58)
      ).rejects.toThrow(mockError);
    });
  });

  describe("signMessage", () => {
    it("should sign a message with a private key (string input)", async () => {
      const result = await ed25519Service.signMessage(
        MESSAGE,
        PRIVATE_KEY_BASE58
      );

      expect(nobleEd25519.sign).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.any(Uint8Array)
      );
      expect(result).toBe(SIGNATURE_BASE58);

      const signCall = vi.mocked(nobleEd25519.sign).mock.calls[0];
      const messageArg = signCall[0];
      expect(messageArg).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(messageArg)).toBe(MESSAGE);
    });

    it("should sign a message with a private key (Uint8Array input)", async () => {
      const result = await ed25519Service.signMessage(
        MESSAGE_BYTES,
        PRIVATE_KEY_BASE58
      );

      expect(nobleEd25519.sign).toHaveBeenCalledWith(
        MESSAGE_BYTES,
        expect.any(Uint8Array)
      );
      expect(result).toBe(SIGNATURE_BASE58);
    });

    it("should throw an error if signing fails", async () => {
      const mockError = new Error("Signing failed");
      vi.mocked(nobleEd25519.sign).mockRejectedValueOnce(mockError);

      await expect(
        ed25519Service.signMessage(MESSAGE, PRIVATE_KEY_BASE58)
      ).rejects.toThrow(mockError);
    });
  });

  describe("verifySignature", () => {
    it("should verify a signature with a public key (string message)", async () => {
      const result = await ed25519Service.verifySignature(
        MESSAGE,
        SIGNATURE_BASE58,
        PUBLIC_KEY_BASE58
      );

      expect(nobleEd25519.verify).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.any(Uint8Array),
        expect.any(Uint8Array)
      );
      expect(result).toBe(true);

      const verifyCall = vi.mocked(nobleEd25519.verify).mock.calls[0];
      const messageArg = verifyCall[1];
      expect(messageArg).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(messageArg)).toBe(MESSAGE);
    });

    it("should verify a signature with a public key (Uint8Array message)", async () => {
      const result = await ed25519Service.verifySignature(
        MESSAGE_BYTES,
        SIGNATURE_BASE58,
        PUBLIC_KEY_BASE58
      );

      expect(nobleEd25519.verify).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        MESSAGE_BYTES,
        expect.any(Uint8Array)
      );
      expect(result).toBe(true);
    });

    it("should return false if verification fails", async () => {
      vi.mocked(nobleEd25519.verify).mockResolvedValueOnce(false);

      const result = await ed25519Service.verifySignature(
        MESSAGE,
        SIGNATURE_BASE58,
        PUBLIC_KEY_BASE58
      );

      expect(result).toBe(false);
    });

    it("should return false if an error occurs during verification", async () => {
      vi.mocked(nobleEd25519.verify).mockRejectedValueOnce(
        new Error("Verification error")
      );

      const result = await ed25519Service.verifySignature(
        MESSAGE,
        SIGNATURE_BASE58,
        PUBLIC_KEY_BASE58
      );

      expect(result).toBe(false);
    });
  });
});
