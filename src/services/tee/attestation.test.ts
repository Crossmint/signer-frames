/**
 * SECURITY CRITICAL: AttestationService Test Suite
 *
 * This service validates Intel TDX TEE attestations for cryptographic key access.
 * Security properties tested:
 * 1. TEE authenticity validation (hardware attestation verification)
 * 2. Public key attestation integrity (cryptographic proof validation)
 * 3. RTMR3 measurement verification (calculated vs reported values)
 * 4. Application identity enforcement (prevents unauthorized app access)
 * 5. Secure failure modes (proper error handling without data leakage)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { AttestationService } from './attestation';
import type { CrossmintApiService } from '../api';

// Mock WASM functions - minimal mocking just for imports
vi.mock('@phala/dcap-qvl-web', () => ({
  default: vi.fn(),
  js_get_collateral: vi.fn(),
  js_verify: vi.fn(),
}));

vi.mock('@phala/dcap-qvl-web/dcap-qvl-web_bg.wasm', () => ({
  default: 'mock-wasm-buffer',
}));

vi.mock('./environment', () => ({
  isDevelopment: () => false,
}));

const VALID_PUBLIC_KEY =
  'BE2tK2+EUljfdSAvTy9qR7Osk1roVfsB+FDdmz5lfl6ZBLXUUa5I/FQwwh/Hh5QLUwpqAW+EyMDN/X0Ikd4eROuBTCyMNc9gGVmRKKZpCtUv24O5uvRINvswGOZ1ibiYjQ==';
const VALID_APP_ID = '0ade7b12204222a684b6e8e26aa5223f38e90725';

describe('AttestationService - Security Critical Tests', () => {
  let service: AttestationService;
  let mockApiService: MockProxy<CrossmintApiService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiService = mock<CrossmintApiService>();
    service = new AttestationService(mockApiService, VALID_APP_ID);
  });

  describe('TEE Authenticity Validation - Core Security Function', () => {
    // These tests require WASM mocking since they test the verifyTEEReport method
    // biome-ignore lint/suspicious/noExplicitAny: WASM mock functions require any for testing
    let mockWasmInit: any;
    // biome-ignore lint/suspicious/noExplicitAny: WASM mock functions require any for testing
    let mockJsGetCollateral: any;
    // biome-ignore lint/suspicious/noExplicitAny: WASM mock functions require any for testing
    let mockJsVerify: any;

    beforeEach(async () => {
      // Setup WASM mocks for TEE report verification tests
      const wasmModule = await import('@phala/dcap-qvl-web');
      mockWasmInit = vi.mocked(wasmModule.default);
      mockJsGetCollateral = vi.mocked(wasmModule.js_get_collateral);
      mockJsVerify = vi.mocked(wasmModule.js_verify);

      // Default successful WASM operations
      mockWasmInit.mockResolvedValue(undefined);
      mockJsGetCollateral.mockResolvedValue('mock-collateral');
      mockJsVerify.mockResolvedValue({
        status: 'UpToDate',
        report: {
          TD10: {
            report_data: 'a'.repeat(128), // 64 bytes in hex
            rt_mr3: 'b'.repeat(96), // 48 bytes in hex
          },
        },
      });
    });

    it('SECURITY: Should successfully validate authentic TEE attestation', async () => {
      const validQuote = 'valid-quote-hex';

      const report = await service.verifyTEEReport(validQuote);

      expect(report.status).toBe('UpToDate');
      expect(mockWasmInit).toHaveBeenCalledWith('mock-wasm-buffer');
      expect(mockJsGetCollateral).toHaveBeenCalled();
      expect(mockJsVerify).toHaveBeenCalled();
    });

    it('SECURITY: Should reject attestation with invalid TEE status', async () => {
      const validQuote = 'valid-quote-hex';
      mockJsVerify.mockResolvedValue({
        status: 'OutOfDate', // Invalid status
        report: {
          TD10: {
            report_data: 'a'.repeat(128),
            rt_mr3: 'b'.repeat(96),
          },
        },
      });

      await expect(service.verifyTEEReport(validQuote)).rejects.toThrow(
        'TEE attestation is invalid'
      );
    });

    it('SECURITY: Should handle malformed TEE report structure', async () => {
      const validQuote = 'valid-quote-hex';
      mockJsVerify.mockResolvedValue({
        // Missing required fields
        invalid: 'structure',
      });

      await expect(service.verifyTEEReport(validQuote)).rejects.toThrow();
    });
  });

  describe('Public Key Attestation Integrity - Cryptographic Proof Validation', () => {
    it('SECURITY: Should validate authentic public key attestation', async () => {
      // Create valid report data that matches the public key
      const prefixBytes = new TextEncoder().encode('app-data:');
      const publicKeyBytes = new Uint8Array(Buffer.from(VALID_PUBLIC_KEY, 'base64'));
      const combined = new Uint8Array(prefixBytes.length + publicKeyBytes.length);
      combined.set(prefixBytes, 0);
      combined.set(publicKeyBytes, prefixBytes.length);

      const hash = await crypto.subtle.digest('SHA-512', combined);
      const reportData = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      await expect(service.verifyTEEPublicKey(reportData, VALID_PUBLIC_KEY)).resolves.not.toThrow();
    });

    it('SECURITY: Should reject invalid report data hash length', async () => {
      const invalidReportData = 'a'.repeat(126); // Not 64 bytes
      const validPublicKey = VALID_PUBLIC_KEY;

      await expect(service.verifyTEEPublicKey(invalidReportData, validPublicKey)).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });

    it('SECURITY: Should detect public key hash tampering', async () => {
      const tamperedReportData = 'f'.repeat(128); // Valid length but wrong hash
      const validPublicKey = VALID_PUBLIC_KEY;

      await expect(service.verifyTEEPublicKey(tamperedReportData, validPublicKey)).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });

    it('SECURITY: Should handle malformed hex data', async () => {
      const invalidReportData = 'xyz'.repeat(43); // Invalid hex characters
      const validPublicKey = VALID_PUBLIC_KEY;

      await expect(service.verifyTEEPublicKey(invalidReportData, validPublicKey)).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });

    it('SECURITY: Should handle invalid base64 public key', async () => {
      const validReportData = 'a'.repeat(128);
      const invalidPublicKey = 'invalid-base64!@#';

      await expect(service.verifyTEEPublicKey(validReportData, invalidPublicKey)).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });
  });

  describe('TEE Application Integrity', () => {
    const validAppId = '0ade7b12204222a684b6e8e26aa5223f38e90725';
    const validEventLog = [
      {
        imr: 3,
        event_type: 134217729,
        digest:
          '738ae348dbf674b3399300c0b9416c203e9b645c6ffee233035d09003cccad12f71becc805ad8d97575bc790c6819216',
        event: 'rootfs-hash',
        event_payload: '4a89dadfa8c6be6d312beb51e24ef5bd4b3aeb695f11f4e2ff9c87eac907389b',
      },
      {
        imr: 3,
        event_type: 134217729,
        digest:
          '993d41d02e173811ebc95ea58382e53f2cd9ec3d10a2b4a710b88b4c56468b311ae17d4578761c8b4befcae28f19f72c',
        event: 'app-id',
        event_payload: validAppId,
      },
      {
        imr: 3,
        event_type: 134217729,
        digest:
          'acff145946a80cd74ddffe5739043ac80340518e0bbe2fe348ffdee8608a6d9c7869b492c7165ef3ea1b551c81685d47',
        event: 'compose-hash',
        event_payload: '8796c5e1f01e94c8e24ff61043a5595eb63b89f6178ca9f0bf9fb91808a8d517',
      },
      {
        imr: 3,
        event_type: 134217729,
        digest:
          '958707e22602f4cd46c08709835e6a376db40d03334b4f778155e7905a002903b8a0ea12b89e8ada3b39ee0f2aeabe68',
        event: 'ca-cert-hash',
        event_payload: 'd09ae26bfa93155e53aa5b7c66a6471e464ddae6ccc8d887e937b71e6c215ba0',
      },
      {
        imr: 3,
        event_type: 134217729,
        digest:
          'b42765eacf83068159cf09338283e6fd99d78d904daaddd7508690e59a634b1cb0351084f17ef2504a52eb910e43af24',
        event: 'instance-id',
        event_payload: '8d358c810ce640f72d56570a1ccb6c9cf9773fce',
      },
    ];

    const validRtmr3 =
      '443010407d16e1884fe159614e71b03d7f6640a3726079821e62a995704527464777cdf3f753bb38d82c1d012f5ecb1d';

    describe('RTMR3 Measurement Verification', () => {
      it('SECURITY: happy path :)', async () => {
        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(validEventLog), validRtmr3)
        ).resolves.not.toThrow();
      });

      it('SECURITY: Should detect RTMR3 value tampering', async () => {
        const wrongRtmr3 =
          '1aef4999a3fbdb9957cbebe37bc60ef6a77024063dc97c9be6718fb4fdabf45e555f08d06023ae3ee48b9baf27b60c39';

        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(validEventLog), wrongRtmr3)
        ).rejects.toThrow(`RTMR3 mismatch: calculated ${validRtmr3} != reported ${wrongRtmr3}`);
      });
    });

    describe('Application Identity Enforcement', () => {
      it('SECURITY: Should reject unauthorized application IDs', async () => {
        const eventLogWithWrongAppId = validEventLog.filter(log => log.event !== 'app-id');

        const invalidAppId = '0dae7b21204222a684b6e8e26aa5223f38e90728';
        eventLogWithWrongAppId.push({
          imr: 3,
          event_type: 134217729,
          digest:
            '993d41d02e173811ebc95ea58382e53f2cd9ec3d10a2b4a710b88b4c56468b311ae17d4578761c8b4befcae28f19f72c',
          event: 'app-id',
          event_payload: invalidAppId,
        });

        const preCalculatedRTMR3Value =
          '1aef4999a3fbdb9957cbebe37bc60ef6a77024063dc97c9be6718fb4fdabf45e555f08d06023ae3ee48b9baf27b60c39';

        // Now test with the correct RTMR3 - this should fail on app ID validation
        await expect(
          service.verifyTEEApplicationIntegrity(
            JSON.stringify(eventLogWithWrongAppId),
            preCalculatedRTMR3Value
          )
        ).rejects.toThrow(`Invalid app ID: expected ${validAppId}, got ${invalidAppId}`);
      });

      it('SECURITY: Should reject malformed event log structure', async () => {
        const invalidJson = 'not-valid-json';

        await expect(
          service.verifyTEEApplicationIntegrity(invalidJson, 'any-rtmr3')
        ).rejects.toThrow();
      });

      it('SECURITY: Should reject incomplete event logs', async () => {
        const incompleteEventLog = JSON.stringify([
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest1',
            event: 'rootfs-hash',
            event_payload: 'a'.repeat(64),
          },
          // Missing other required events: app-id, compose-hash, ca-cert-hash, instance-id
        ]);

        await expect(
          service.verifyTEEApplicationIntegrity(incompleteEventLog, 'any-rtmr3')
        ).rejects.toThrow();
      });

      it('SECURITY: Should reject event logs with wrong IMR', async () => {
        const wrongImrEventLog = JSON.stringify(validEventLog.map(log => ({ ...log, imr: 2 })));

        await expect(
          service.verifyTEEApplicationIntegrity(wrongImrEventLog, validRtmr3)
        ).rejects.toThrow();
      });

      it('SECURITY: Should reject event logs with wrong event type', async () => {
        const wrongTypeEventLog = JSON.stringify(
          validEventLog.map(log => ({ ...log, event_type: 125217729 }))
        );

        await expect(
          service.verifyTEEApplicationIntegrity(wrongTypeEventLog, validRtmr3)
        ).rejects.toThrow();
      });
    });
  });

  describe('Secure Failure Modes - Error Handling Security', () => {
    it('SECURITY: Should prevent access to uninitialized service', async () => {
      await expect(service.getAttestedPublicKey()).rejects.toThrow(
        'Attestation service has not been initialized!'
      );
    });

    it('SECURITY: Should handle malformed API responses', async () => {
      mockApiService.getAttestation.mockResolvedValue({
        quote: 'invalid-quote',
        publicKey: 'invalid-key',
        event_log: 'invalid-log',
        hash_algorithm: 'sha512',
        prefix: 'app-data',
      });

      await expect(service.init()).rejects.toThrow();
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle empty event log array', async () => {
      const emptyEventLog = JSON.stringify([]);

      await expect(
        service.verifyTEEApplicationIntegrity(emptyEventLog, 'any-rtmr3')
      ).rejects.toThrow();
    });

    it('should handle null/undefined inputs gracefully', async () => {
      await expect(service.verifyTEEPublicKey('', '')).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
      await expect(service.verifyTEEApplicationIntegrity('{}', '')).rejects.toThrow();
    });

    it('should handle very large hex values', async () => {
      const largeHex = 'f'.repeat(10000);
      await expect(service.verifyTEEPublicKey(largeHex, VALID_PUBLIC_KEY)).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });
  });
});
