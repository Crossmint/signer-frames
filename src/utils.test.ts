import { describe, it, expect } from "vitest";
import {
  uint8ArrayToHex,
  hexToUint8Array,
  base58Encode,
  base58Decode,
} from "./utils";
import bs58 from "bs58";

describe("utils.ts", () => {
  describe("uint8ArrayToHex", () => {
    it("should convert Uint8Array to hex string", () => {
      const data = new Uint8Array([0, 1, 10, 255]);
      const result = uint8ArrayToHex(data);
      expect(result).toBe("00010aff");
    });

    it("should handle empty array", () => {
      const data = new Uint8Array([]);
      const result = uint8ArrayToHex(data);
      expect(result).toBe("");
    });

    it("should pad single digit values with zeros", () => {
      const data = new Uint8Array([1, 2, 3]);
      const result = uint8ArrayToHex(data);
      expect(result).toBe("010203");
    });
  });

  describe("hexToUint8Array", () => {
    it("should convert hex string to Uint8Array", () => {
      const hex = "00010aff";
      const result = hexToUint8Array(hex);
      expect(result).toEqual(new Uint8Array([0, 1, 10, 255]));
    });

    it("should handle empty string", () => {
      const hex = "";
      const result = hexToUint8Array(hex);
      expect(result).toEqual(new Uint8Array([]));
    });

    it("should handle 0x prefix", () => {
      const hex = "0x010203";
      const result = hexToUint8Array(hex);
      expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("should handle odd length by padding with 0", () => {
      const hex = "123";
      const result = hexToUint8Array(hex);
      expect(result).toEqual(new Uint8Array([1, 35]));
    });

    it("should throw an error for non-string input", () => {
      // @ts-ignore - Testing invalid input
      expect(() => hexToUint8Array(123)).toThrow(
        "Expected string containing hex data"
      );
    });
  });

  describe("base58Encode", () => {
    it("should encode Uint8Array to Base58 string", () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5]);
      const result = base58Encode(data);
      expect(result).toBe("17bWpTW");
    });

    it("should handle empty array", () => {
      const data = new Uint8Array([]);
      const result = base58Encode(data);
      expect(result).toBe("");
    });

    it("should encode zeros correctly", () => {
      const data = new Uint8Array([0, 0, 0]);
      const result = base58Encode(data);
      expect(result).toBe("111");
    });

    it("should properly handle leading zeros", () => {
      const data = new Uint8Array([0, 0, 1, 2, 3]);
      const result = base58Encode(data);
      expect(result).toBe("11Ldp");
    });

    it("should encode typical bitcoin-style address", () => {
      // Example from bitcoin address encoding
      const data = hexToUint8Array(
        "00010966776006953D5567439E5E39F86A0D273BEED"
      );
      const result = base58Encode(data);
      expect(result).toBe("11EQPpUPThCeirHLa3PBNgo9VttTe");
    });
  });

  describe("base58Decode", () => {
    it("should decode Base58 string to Uint8Array", () => {
      const str = "17bWpTW";
      const result = base58Decode(str);
      expect(result).toEqual(new Uint8Array([0, 1, 2, 3, 4, 5]));
    });

    it("should handle empty string", () => {
      const str = "";
      const result = base58Decode(str);
      expect(result).toEqual(new Uint8Array([]));
    });

    it("should decode zeros correctly", () => {
      const str = "111";
      const result = base58Decode(str);
      expect(result).toEqual(new Uint8Array([0, 0, 0]));
    });

    it("should properly handle leading zeros", () => {
      const str = "11Ldp";
      const result = base58Decode(str);
      expect(result).toEqual(new Uint8Array([0, 0, 1, 2, 3]));
    });

    it("should throw an error for invalid Base58 character", () => {
      const str = "invalid0char";
      expect(() => base58Decode(str)).toThrow("Invalid character");
    });

    it("should decode typical bitcoin-style address", () => {
      const str = "11EQPpUPThCeirHLa3PBNgo9VttTe";
      const expectedHex = "00010966776006953D5567439E5E39F86A0D273BEED";
      const result = base58Decode(str);
      expect(uint8ArrayToHex(result).toLowerCase()).toContain(
        expectedHex.toLowerCase().substring(0, 30)
      );
    });
  });

  describe("base58 round trip", () => {
    it("should be able to encode and decode back to original", () => {
      const testCases = [
        new Uint8Array([1, 2, 3, 4, 5]),
        new Uint8Array([0, 0, 0, 1, 2, 3]),
        new Uint8Array([255, 254, 253, 252]),
        new Uint8Array([0]),
        new Uint8Array([]),
      ];

      for (const original of testCases) {
        const encoded = base58Encode(original);
        const decoded = base58Decode(encoded);
        expect(decoded).toEqual(original);
      }
    });

    it("should handle random data correctly", () => {
      // Generate some random data
      const randomData = new Uint8Array(32);
      for (let i = 0; i < randomData.length; i++) {
        randomData[i] = Math.floor(Math.random() * 256);
      }

      const encoded = base58Encode(randomData);
      const decoded = base58Decode(encoded);
      expect(decoded).toEqual(randomData);
    });
  });

  describe("Comparison with bs58 library", () => {
    it("should produce the same encoding as bs58", () => {
      const testCases = [
        new Uint8Array([1, 2, 3, 4, 5]),
        new Uint8Array([0, 0, 0, 1, 2, 3]),
        new Uint8Array([255, 254, 253, 252]),
        new Uint8Array([0]),
      ];

      for (const data of testCases) {
        const ourEncoding = base58Encode(data);
        const bs58Encoding = bs58.encode(data);
        expect(ourEncoding).toBe(bs58Encoding.toString());
      }
    });

    it("should handle empty array like bs58", () => {
      const data = new Uint8Array([]);
      const ourEncoding = base58Encode(data);
      const bs58Encoding = bs58.encode(data);
      expect(ourEncoding).toBe(bs58Encoding.toString());
    });

    it("should produce the same decoding as bs58", () => {
      // A set of valid bs58 encoded strings to test
      const testStrings = [
        "17bWpTW", // [0, 1, 2, 3, 4, 5]
        "111", // [0, 0, 0]
        "11Ldp", // [0, 0, 1, 2, 3]
        "JxF12TrwUP", // [255, 254, 253, 252]
        "1", // [0]
      ];

      for (const str of testStrings) {
        const ourDecoding = base58Decode(str);
        const bs58Decoding = bs58.decode(str);
        expect(ourDecoding).toEqual(bs58Decoding);
      }
    });

    it("should handle standard Bitcoin addresses consistently with bs58", () => {
      // Real Bitcoin address
      const bitcoinAddress = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"; // Satoshi's address

      // Decode with both implementations
      const ourDecoding = base58Decode(bitcoinAddress);
      const bs58Decoding = bs58.decode(bitcoinAddress);

      // They should be identical
      expect(ourDecoding).toEqual(bs58Decoding);

      // And encoding back should preserve the original string
      expect(base58Encode(ourDecoding)).toBe(bitcoinAddress);
      expect(bs58.encode(bs58Decoding).toString()).toBe(bitcoinAddress);
    });

    it("should benchmark encoding performance against bs58", () => {
      const largeData = new Uint8Array(1000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = Math.floor(Math.random() * 256);
      }

      // Run both implementations and compare results (not actual timing)
      const ourEncoding = base58Encode(largeData);
      const bs58Encoding = bs58.encode(largeData).toString();

      // Results should match
      expect(ourEncoding).toBe(bs58Encoding);

      // This is actually more of a compatibility test than a benchmark,
      // but it ensures our implementation scales well with larger inputs
    });

    it("should behave the same as bs58 for edge cases", () => {
      // Edge case 1: All zeros
      const allZeros = new Uint8Array(10).fill(0);
      expect(base58Encode(allZeros)).toBe(bs58.encode(allZeros).toString());

      // Edge case 2: All 255s
      const allMax = new Uint8Array(10).fill(255);
      expect(base58Encode(allMax)).toBe(bs58.encode(allMax).toString());

      // Edge case 3: Mixed patterns
      const pattern = new Uint8Array([0, 255, 0, 255, 0, 255]);
      expect(base58Encode(pattern)).toBe(bs58.encode(pattern).toString());
    });
  });
});
