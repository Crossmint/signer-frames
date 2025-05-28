import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the WASM imports before importing the AttestationService
vi.mock('@phala/dcap-qvl-web', () => ({
  default: vi.fn(), // mock the init function
  js_get_collateral: vi.fn(),
  js_verify: vi.fn(),
}));

vi.mock('@phala/dcap-qvl-web/dcap-qvl-web_bg.wasm', () => ({
  default: {},
}));

import { AttestationService } from './attestation';
import { mock } from 'vitest-mock-extended';
import type { CrossmintApiService } from './api';

describe('AttestationService', () => {
  let attestationService: AttestationService;
  let mockApiService: CrossmintApiService;

  beforeEach(() => {
    mockApiService = mock<CrossmintApiService>();
    attestationService = new AttestationService(mockApiService);
  });

  // Helper function to calculate expected hash for a given input
  async function calculateExpectedHash(input: string): Promise<string> {
    const prefixBytes = new TextEncoder().encode('app-data:');
    const inputBytes = new TextEncoder().encode(input);
    const reconstructedReportData = new Uint8Array(prefixBytes.length + inputBytes.length);
    reconstructedReportData.set(prefixBytes, 0);
    reconstructedReportData.set(inputBytes, prefixBytes.length);

    const hash = await crypto.subtle.digest('SHA-512', reconstructedReportData);
    const hashArray = Array.from(new Uint8Array(hash));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  describe('init and attestation verification', () => {
    it('should successfully initialize with valid attestation (happy path)', async () => {
      const testPublicKey = 'SGVsbG8gV29ybGQ='; // base64 "Hello World"
      const expectedReportData = await calculateExpectedHash('Hello World');

      // Mock API response
      vi.mocked(mockApiService.getAttestation).mockResolvedValue({
        quote: 'abcdef123456', // hex encoded quote
        publicKey: testPublicKey,
      });

      // Mock js_verify to return valid attestation with correct report data
      const { js_verify } = await import('@phala/dcap-qvl-web');
      vi.mocked(js_verify).mockResolvedValue({
        status: 'UpToDate',
        report: {
          TD10: {
            report_data: expectedReportData,
          },
        },
      });

      const result = await attestationService.verifyAttestationAndParseKey();
      expect(result).toBe(testPublicKey);
    });

    it('should throw error when TEE attestation status is invalid', async () => {
      const testPublicKey = 'SGVsbG8gV29ybGQ=';

      vi.mocked(mockApiService.getAttestation).mockResolvedValue({
        quote: 'abcdef123456',
        publicKey: testPublicKey,
      });

      // Mock js_verify to return invalid status
      const { js_verify } = await import('@phala/dcap-qvl-web');
      vi.mocked(js_verify).mockResolvedValue({
        status: 'OutOfDate', // Invalid status
        report: {
          TD10: {
            report_data: 'some_hash',
          },
        },
      });

      await expect(attestationService.verifyAttestationAndParseKey()).rejects.toThrow(
        'TEE attestation is invalid'
      );
    });

    it('should throw error when public key hash does not match report data', async () => {
      const testPublicKey = 'SGVsbG8gV29ybGQ='; // base64 "Hello World"
      const wrongReportData = '0'.repeat(128); // Wrong hash but correct length

      vi.mocked(mockApiService.getAttestation).mockResolvedValue({
        quote: 'abcdef123456',
        publicKey: testPublicKey,
      });

      // Mock js_verify to return valid status but wrong report data
      const { js_verify } = await import('@phala/dcap-qvl-web');
      vi.mocked(js_verify).mockResolvedValue({
        status: 'UpToDate',
        report: {
          TD10: {
            report_data: wrongReportData, // This won't match the public key hash
          },
        },
      });

      await expect(attestationService.verifyAttestationAndParseKey()).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });

    it('should throw error when attestation report has invalid structure', async () => {
      const testPublicKey = 'SGVsbG8gV29ybGQ=';

      vi.mocked(mockApiService.getAttestation).mockResolvedValue({
        quote: 'abcdef123456',
        publicKey: testPublicKey,
      });

      // Mock js_verify to return malformed report structure
      const { js_verify } = await import('@phala/dcap-qvl-web');
      vi.mocked(js_verify).mockResolvedValue({
        status: 'UpToDate',
        // Missing required report.TD10 structure
        report: {
          malformed: 'data',
        },
      });

      await expect(attestationService.verifyAttestationAndParseKey()).rejects.toThrow();
    });
  });

  describe('reportAttestsPublicKey', () => {
    it('should return true when the public key hash matches the report data', async () => {
      const publicKey = 'SGVsbG8gV29ybGQ='; // base64 encoded "Hello World"
      const expectedReportData = await calculateExpectedHash('Hello World');

      const result = await attestationService.reportAttestsPublicKey(expectedReportData, publicKey);

      expect(result).toBe(true);
    });

    it('should return false for mismatched hashes and wrong data', async () => {
      const publicKey = 'dGVzdA=='; // base64 encoded "test"

      const testCases = [
        'abcdef1234567890'.repeat(8), // Wrong hash, correct length
        '1234567890abcdef'.repeat(8), // Different wrong hash
        '0'.repeat(128), // All zeros, correct length
      ];

      for (const wrongReportData of testCases) {
        const result = await attestationService.reportAttestsPublicKey(wrongReportData, publicKey);
        expect(result).toBe(false);
      }
    });

    it('should handle empty inputs correctly', async () => {
      const emptyPublicKey = ''; // empty base64 string
      const expectedHash = await calculateExpectedHash('');

      const result = await attestationService.reportAttestsPublicKey(expectedHash, emptyPublicKey);
      expect(result).toBe(true);

      // Empty report data should fail
      const result2 = await attestationService.reportAttestsPublicKey('', 'dGVzdA==');
      expect(result2).toBe(false);
    });

    it('should reject invalid lengths (SHA-512 must be exactly 64 bytes)', async () => {
      const publicKey = 'dGVzdA==';

      const invalidLengths = [
        'abcd', // Too short (2 bytes)
        'a'.repeat(126), // 63 bytes
        'a'.repeat(130), // 65 bytes
        'a'.repeat(64), // 32 bytes
        'a'.repeat(256), // 128 bytes
        '', // Empty
      ];

      for (const invalidLength of invalidLengths) {
        const result = await attestationService.reportAttestsPublicKey(invalidLength, publicKey);
        expect(result).toBe(false);
      }
    });

    it('should accept exactly 128 hex characters and handle case insensitivity', async () => {
      const publicKey = 'dGVzdA=='; // base64 encoded "test"
      const expectedHash = await calculateExpectedHash('test');

      // Verify it's exactly 128 characters (64 bytes)
      expect(expectedHash).toHaveLength(128);

      const upperCaseHash = expectedHash.toUpperCase();
      const mixedCaseHash = expectedHash
        .split('')
        .map((char, i) => (i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()))
        .join('');

      // All case variations should work
      expect(await attestationService.reportAttestsPublicKey(expectedHash, publicKey)).toBe(true);
      expect(await attestationService.reportAttestsPublicKey(upperCaseHash, publicKey)).toBe(true);
      expect(await attestationService.reportAttestsPublicKey(mixedCaseHash, publicKey)).toBe(true);
    });

    it('should handle invalid characters gracefully without crashing', async () => {
      const publicKey = 'dGVzdA==';

      // Invalid hex characters
      const invalidHexCases = [
        `gggggggg${'a'.repeat(120)}`, // Contains 'g'
        `xyz${'a'.repeat(125)}`, // Contains 'x', 'y', 'z'
        `0x${'a'.repeat(126)}`, // Contains '0x' prefix
        `你好世界${'a'.repeat(120)}`, // Unicode characters
        `🚀🎉${'a'.repeat(124)}`, // Emojis
      ];

      for (const invalidHex of invalidHexCases) {
        const result = await attestationService.reportAttestsPublicKey(invalidHex, publicKey);
        expect(result).toBe(false);
      }
    });

    it('should handle invalid base64 inputs gracefully', async () => {
      const validHash = await calculateExpectedHash('test');

      const invalidBase64Cases = [
        '!!!invalid', // Completely invalid
        'dGVzdA=!', // Contains '!'
        'dGVzdA==@', // Contains '@'
        'αβγδ', // Greek letters
        'dG#Vzd', // Contains '#'
        'dGVzdA===', // Too much padding
      ];

      for (const invalidBase64 of invalidBase64Cases) {
        const result = await attestationService.reportAttestsPublicKey(validHash, invalidBase64);
        expect(result).toBe(false);
      }
    });

    it('should handle large inputs and perform efficiently', async () => {
      const publicKey = 'dGVzdA==';

      // Large inputs should fail gracefully, not crash
      const largeHexInput = 'a'.repeat(10000);
      const largeBase64Input = 'dGVzdA=='.repeat(1000);

      expect(await attestationService.reportAttestsPublicKey(largeHexInput, publicKey)).toBe(false);
      expect(
        await attestationService.reportAttestsPublicKey('a'.repeat(128), largeBase64Input)
      ).toBe(false);

      // Performance check on obvious mismatch
      const start = performance.now();
      const result = await attestationService.reportAttestsPublicKey('0'.repeat(128), publicKey);
      const end = performance.now();

      expect(result).toBe(false);
      expect(end - start).toBeLessThan(100); // Should be fast
    });
  });
});
