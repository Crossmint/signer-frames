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

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { AttestationService } from './attestation';
import type { CrossmintApiService } from './api';
import { mockCrypto, mockConsole } from '../tests/test-utils';

// Security test constants
const EXPECTED_APP_ID = '0ade7b12204222a684b6e8e26aa5223f38e90725';
const VALID_PUBLIC_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA';
const VALID_QUOTE_HEX =
  '308201a23082014aa003020102020101300a06082a8648ce3d0403023049310b300906035504061302555331133011060355040a0c0a4578616d706c6520434131253023060355040b0c1c4578616d706c6520434120456e6769';
const VALID_REPORT_DATA_64_BYTES = Array.from(new Uint8Array(64).fill(0))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');
const MOCK_RTMR3_VALUE = Array.from(new Uint8Array(48).fill(170))
  .map(byte => byte.toString(16).padStart(2, '0'))
  .join('');

// Valid event log with all required hash events
const VALID_EVENT_LOG = JSON.stringify([
  {
    imr: 3,
    event_type: 134217729,
    digest: 'digest1',
    event: 'rootfs-hash',
    event_payload: '4a89dadfa8c6be6d312beb51e24ef5bd4b3aeb695f11f4e2ff9c87eac907389b',
  },
  {
    imr: 3,
    event_type: 134217729,
    digest: 'digest2',
    event: 'app-id',
    event_payload: EXPECTED_APP_ID,
  },
  {
    imr: 3,
    event_type: 134217729,
    digest: 'digest3',
    event: 'compose-hash',
    event_payload: '8796c5e1f01e94c8e24ff61043a5595eb63b89f6178ca9f0bf9fb91808a8d517',
  },
  {
    imr: 3,
    event_type: 134217729,
    digest: 'digest4',
    event: 'ca-cert-hash',
    event_payload: 'd09ae26bfa93155e53aa5b7c66a6471e464ddae6ccc8d887e937b71e6c215ba0',
  },
  {
    imr: 3,
    event_type: 134217729,
    digest: 'digest5',
    event: 'instance-id',
    event_payload: '8d358c810ce640f72d56570a1ccb6c9cf9773fce',
  },
]);

// Mock TEE report and attestation response
const VALID_TEE_REPORT = {
  status: 'UpToDate',
  report: { TD10: { report_data: VALID_REPORT_DATA_64_BYTES, rt_mr3: MOCK_RTMR3_VALUE } },
};

const VALID_ATTESTATION_RESPONSE = {
  quote: VALID_QUOTE_HEX,
  publicKey: VALID_PUBLIC_KEY,
  event_log: VALID_EVENT_LOG,
};

// Mock WASM functions
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

describe('AttestationService - Security Critical Tests', () => {
  let service: AttestationService;
  let mockApiService: MockProxy<CrossmintApiService>;
  // biome-ignore lint/suspicious/noExplicitAny: WASM mock functions require any for testing
  let mockWasmInit: MockedFunction<(...args: any[]) => Promise<any>>;
  // biome-ignore lint/suspicious/noExplicitAny: WASM mock functions require any for testing
  let mockJsGetCollateral: MockedFunction<(...args: any[]) => Promise<any>>;
  // biome-ignore lint/suspicious/noExplicitAny: WASM mock functions require any for testing
  let mockJsVerify: MockedFunction<(...args: any[]) => Promise<any>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsole();

    // Setup WASM mocks
    const wasmModule = await import('@phala/dcap-qvl-web');
    mockWasmInit = vi.mocked(wasmModule.default);
    mockJsGetCollateral = vi.mocked(wasmModule.js_get_collateral);
    mockJsVerify = vi.mocked(wasmModule.js_verify);

    // Setup service dependencies
    mockApiService = mock<CrossmintApiService>();
    service = new AttestationService(mockApiService);

    // Setup crypto mocks and default successful WASM operations
    mockCrypto();
    mockWasmInit.mockResolvedValue(undefined);
    mockJsGetCollateral.mockResolvedValue('mock-collateral');
    mockJsVerify.mockResolvedValue(VALID_TEE_REPORT);
  });

  describe('TEE Authenticity Validation - Core Security Function', () => {
    it('SECURITY: Should successfully validate authentic TEE attestation', async () => {
      mockApiService.getAttestation.mockResolvedValue(VALID_ATTESTATION_RESPONSE);
      setupValidCryptoMocks();

      await service.init();
      const publicKey = await service.getAttestedPublicKey();

      expect(publicKey).toBe(VALID_PUBLIC_KEY);
      expect(mockWasmInit).toHaveBeenCalledWith('mock-wasm-buffer');
      expect(mockJsGetCollateral).toHaveBeenCalled();
      expect(mockJsVerify).toHaveBeenCalled();
    });

    it('SECURITY: Should reject attestation with invalid TEE status', async () => {
      mockApiService.getAttestation.mockResolvedValue(VALID_ATTESTATION_RESPONSE);
      mockJsVerify.mockResolvedValue({ ...VALID_TEE_REPORT, status: 'OutOfDate' });

      await expect(service.init()).rejects.toThrow('TEE attestation is invalid');
    });

    it('SECURITY: Should reject malformed attestation report structure', async () => {
      mockApiService.getAttestation.mockResolvedValue(VALID_ATTESTATION_RESPONSE);
      mockJsVerify.mockResolvedValue({ invalid: 'structure' });

      await expect(service.init()).rejects.toThrow();
    });

    it('SECURITY: Should handle WASM component failures securely', async () => {
      mockApiService.getAttestation.mockResolvedValue(VALID_ATTESTATION_RESPONSE);
      mockWasmInit.mockRejectedValue(new Error('WASM init failed'));

      await expect(service.init()).rejects.toThrow('WASM init failed');
    });

    it('SECURITY: Should handle quote verification failures', async () => {
      mockApiService.getAttestation.mockResolvedValue(VALID_ATTESTATION_RESPONSE);
      mockJsVerify.mockRejectedValue(new Error('Verification failed'));

      await expect(service.init()).rejects.toThrow('Verification failed');
    });
  });

  describe('Public Key Attestation Integrity - Cryptographic Proof Validation', () => {
    it('SECURITY: Should reject invalid report data hash length', async () => {
      const shortReportData = {
        ...VALID_TEE_REPORT,
        report: { TD10: { report_data: '6170702d646174613a00', rt_mr3: MOCK_RTMR3_VALUE } },
      };

      mockApiService.getAttestation.mockResolvedValue(VALID_ATTESTATION_RESPONSE);
      mockJsVerify.mockResolvedValue(shortReportData);
      setupPublicKeyFailureMocks();

      await expect(service.init()).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });

    it('SECURITY: Should detect public key hash tampering', async () => {
      mockApiService.getAttestation.mockResolvedValue(VALID_ATTESTATION_RESPONSE);
      mockJsVerify.mockResolvedValue(VALID_TEE_REPORT);
      setupPublicKeyFailureMocks('tampering');

      await expect(service.init()).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });

    it('SECURITY: Should handle cryptographic digest failures', async () => {
      mockApiService.getAttestation.mockResolvedValue(VALID_ATTESTATION_RESPONSE);
      mockJsVerify.mockResolvedValue(VALID_TEE_REPORT);
      setupPublicKeyFailureMocks('crypto-error');

      await expect(service.init()).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });
  });

  describe('RTMR3 Measurement Verification - TEE Integrity Validation', () => {
    it('SECURITY: Should detect RTMR3 value tampering', async () => {
      const tamperedReport = {
        ...VALID_TEE_REPORT,
        report: {
          TD10: { report_data: VALID_REPORT_DATA_64_BYTES, rt_mr3: 'tampered-rtmr3-value' },
        },
      };

      mockApiService.getAttestation.mockResolvedValue(VALID_ATTESTATION_RESPONSE);
      mockJsVerify.mockResolvedValue(tamperedReport);
      setupBasicCryptoMocks();

      await expect(service.init()).rejects.toThrow(
        /RTMR3 mismatch: calculated .* != reported tampered-rtmr3-value/
      );
    });

    it('SECURITY: Should handle RTMR3 calculation failures', async () => {
      const reportWithValidPublicKey = {
        ...VALID_TEE_REPORT,
        report: { TD10: { report_data: VALID_REPORT_DATA_64_BYTES, rt_mr3: 'any-value' } },
      };

      mockApiService.getAttestation.mockResolvedValue(VALID_ATTESTATION_RESPONSE);
      mockJsVerify.mockResolvedValue(reportWithValidPublicKey);

      let digestCallCount = 0;
      crypto.subtle.digest = vi.fn().mockImplementation(async () => {
        digestCallCount++;
        if (digestCallCount === 1) return new Uint8Array(64).fill(0).buffer; // Public key validation passes
        throw new Error('RTMR3 calculation failed'); // RTMR3 calculation fails
      });

      await expect(service.init()).rejects.toThrow('RTMR3 calculation failed');
    });
  });

  describe('Application Identity Enforcement - Unauthorized Access Prevention', () => {
    it('SECURITY: Should reject unauthorized application IDs', async () => {
      const unauthorizedEventLog = JSON.stringify([
        {
          imr: 3,
          event_type: 134217729,
          digest: 'digest1',
          event: 'rootfs-hash',
          event_payload: '4a89dadfa8c6be6d312beb51e24ef5bd4b3aeb695f11f4e2ff9c87eac907389b',
        },
        {
          imr: 3,
          event_type: 134217729,
          digest: 'digest2',
          event: 'app-id',
          event_payload: 'unauthorized-app-id',
        },
        {
          imr: 3,
          event_type: 134217729,
          digest: 'digest3',
          event: 'compose-hash',
          event_payload: '8796c5e1f01e94c8e24ff61043a5595eb63b89f6178ca9f0bf9fb91808a8d517',
        },
        {
          imr: 3,
          event_type: 134217729,
          digest: 'digest4',
          event: 'ca-cert-hash',
          event_payload: 'd09ae26bfa93155e53aa5b7c66a6471e464ddae6ccc8d887e937b71e6c215ba0',
        },
        {
          imr: 3,
          event_type: 134217729,
          digest: 'digest5',
          event: 'instance-id',
          event_payload: '8d358c810ce640f72d56570a1ccb6c9cf9773fce',
        },
      ]);

      const unauthorizedAttestation = {
        ...VALID_ATTESTATION_RESPONSE,
        event_log: unauthorizedEventLog,
      };

      mockApiService.getAttestation.mockResolvedValue(unauthorizedAttestation);
      setupAppIdTestMocks();

      await expect(service.init()).rejects.toThrow(
        `Invalid app ID: expected ${EXPECTED_APP_ID}, got unauthorized-app-id`
      );
    });

    it('SECURITY: Should reject malformed event log structure', async () => {
      const malformedAttestation = { ...VALID_ATTESTATION_RESPONSE, event_log: 'invalid-json' };

      mockApiService.getAttestation.mockResolvedValue(malformedAttestation);
      setupBasicCryptoMocks();

      await expect(service.init()).rejects.toThrow();
    });

    it('SECURITY: Should reject incomplete event logs', async () => {
      const incompleteEventLog = JSON.stringify([
        {
          imr: 3,
          event_type: 134217729,
          digest: 'digest1',
          event: 'rootfs-hash',
          event_payload: '4a89dadfa8c6be6d312beb51e24ef5bd4b3aeb695f11f4e2ff9c87eac907389b',
        },
        // Missing required events
      ]);

      const incompleteAttestation = {
        ...VALID_ATTESTATION_RESPONSE,
        event_log: incompleteEventLog,
      };

      mockApiService.getAttestation.mockResolvedValue(incompleteAttestation);
      setupBasicCryptoMocks();

      await expect(service.init()).rejects.toThrow();
    });
  });

  describe('Secure Failure Modes - Error Handling Security', () => {
    it('SECURITY: Should prevent access to uninitialized service', async () => {
      await expect(service.getAttestedPublicKey()).rejects.toThrow(
        'Attestation service has not been initialized!'
      );
    });

    it('SECURITY: Should handle API failures without data leakage', async () => {
      mockApiService.getAttestation.mockRejectedValue(new Error('Network error'));

      await expect(service.init()).rejects.toThrow('Network error');
      await expect(service.getAttestedPublicKey()).rejects.toThrow(
        'Attestation service has not been initialized!'
      );
    });

    it('SECURITY: Should provide development mode fallback', async () => {
      const devResponse = { publicKey: 'dev-mode-public-key' };
      mockApiService.getPublicKey.mockResolvedValue(devResponse);

      const result = await service.getPublicKeyDevMode();

      expect(result).toBe('dev-mode-public-key');
      expect(mockApiService.getPublicKey).toHaveBeenCalled();
    });
  });

  // === Consolidated Security Mock Setup Functions ===
  //
  // VALIDATION ORDER: Event log parsing + RTMR3 calculation (SHA-384) → Public key validation (SHA-512) → App ID validation
  // Strategy: Mocks must pass earlier validations to test later ones

  function setupValidCryptoMocks(): void {
    // SECURITY: Complete valid attestation scenario for end-to-end testing
    let digestCallCount = 0;

    crypto.subtle.digest = vi
      .fn()
      .mockImplementation(async (algorithm: string, data: ArrayBuffer) => {
        digestCallCount++;
        const input = new Uint8Array(data);

        if (algorithm === 'SHA-512') {
          // PUBLIC KEY VALIDATION: Match 'app-data:' prefix hash with VALID_REPORT_DATA_64_BYTES
          return input.includes(97)
            ? new Uint8Array(64).fill(0).buffer
            : new Uint8Array(64).fill(1).buffer;
        }

        if (algorithm === 'SHA-384') {
          // RTMR3 CALCULATION: Individual event digests (1-5) then final replay (170 = 0xaa matches MOCK_RTMR3_VALUE)
          return digestCallCount <= 5
            ? new Uint8Array(48).fill(digestCallCount).buffer
            : new Uint8Array(48).fill(170).buffer;
        }

        return new Uint8Array(32).fill(1).buffer;
      });
  }

  function setupPublicKeyFailureMocks(failureType = 'hash-mismatch'): void {
    // SECURITY: RTMR3 validation PASSES → Public key validation FAILS (isolates public key testing)
    let digestCallCount = 0;

    crypto.subtle.digest = vi
      .fn()
      .mockImplementation(async (algorithm: string, data: ArrayBuffer) => {
        digestCallCount++;

        if (algorithm === 'SHA-512') {
          // PUBLIC KEY VALIDATION FAILURE: Different failure modes for different security tests
          if (failureType === 'crypto-error') throw new Error('Crypto error');
          return new Uint8Array(64).fill(255).buffer; // Hash mismatch (tampering/invalid length)
        }

        if (algorithm === 'SHA-384') {
          // RTMR3 VALIDATION SUCCESS: Must pass to reach public key validation
          return digestCallCount <= 5
            ? new Uint8Array(48).fill(digestCallCount).buffer
            : new Uint8Array(48).fill(170).buffer;
        }

        return new Uint8Array(32).fill(1).buffer;
      });
  }

  function setupBasicCryptoMocks(): void {
    // SECURITY: General-purpose mocks for error testing (malformed JSON, missing events, etc.)
    crypto.subtle.digest = vi
      .fn()
      .mockImplementation(async (algorithm: string, data: ArrayBuffer) => {
        if (algorithm === 'SHA-512') return new Uint8Array(64).fill(0).buffer; // Valid public key hash
        if (algorithm === 'SHA-384') {
          // Deterministic but non-matching RTMR3 values based on input data
          const sum = Array.from(new Uint8Array(data)).reduce((acc, val) => acc + val, 0);
          return new Uint8Array(48).fill(sum % 256).buffer;
        }
        return new Uint8Array(48).fill(1).buffer;
      });
  }

  function setupAppIdTestMocks(): void {
    // SECURITY: RTMR3 + Public key validation PASS → App ID validation FAILS (isolates app ID testing)
    let callCount = 0;

    crypto.subtle.digest = vi
      .fn()
      .mockImplementation(async (algorithm: string, data: ArrayBuffer) => {
        callCount++;

        if (algorithm === 'SHA-512') return new Uint8Array(64).fill(0).buffer; // Public key validation passes
        if (algorithm === 'SHA-384') {
          // RTMR3 calculation: Individual digests (1-5) then final replay (85 = 0x55 for app ID test isolation)
          return callCount <= 5
            ? new Uint8Array(48).fill(callCount).buffer
            : new Uint8Array(48).fill(85).buffer;
        }
        return new Uint8Array(48).fill(1).buffer;
      });

    // Create matching TEE report with RTMR3 = 0x55 to pass validation and reach app ID check
    const reportWithMatchingRtmr3 = {
      ...VALID_TEE_REPORT,
      report: {
        TD10: {
          report_data: VALID_REPORT_DATA_64_BYTES,
          rt_mr3: Array.from(new Uint8Array(48).fill(85))
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join(''),
        },
      },
    };

    mockJsVerify.mockResolvedValue(reportWithMatchingRtmr3);
  }
});
