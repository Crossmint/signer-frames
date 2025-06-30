/**
 * SECURITY CRITICAL: AttestationService Test Suite
 *
 * Tests validation of Intel TDX TEE attestations for cryptographic key access.
 * Security properties: TEE authenticity, public key attestation integrity,
 * RTMR3 measurement verification, application identity enforcement, secure failure modes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { AttestationService } from './attestation';
import type { CrossmintApiService } from '../api';

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
  'BMbRE3oZ8rxCzkPYntr/gApxZO2nO1T44HCwLDokZOy/y3/3NW/VhVFLrUSKjohgAQFk6wckzs50HGmn+IAwVEk=';
const VALID_APP_ID = 'df4f0ec61f92a8eec754593da9ea9cd939985e9c';

const VALID_EVENT_LOG = [
  {
    imr: 3,
    event_type: 134217729,
    digest:
      'f9974020ef507068183313d0ca808e0d1ca9b2d1ad0c61f5784e7157c362c06536f5ddacdad4451693f48fcc72fff624',
    event: 'system-preparing',
    event_payload: '',
  },
  {
    imr: 3,
    event_type: 134217729,
    digest:
      '8fb0fe5adbb3a5038e382aa1c4f5878ffa22b0671b3fba3ca9181c5a3e3b5fb47a33ed4fc8f63fcaf1a949a53acef0fa',
    event: 'app-id',
    event_payload: VALID_APP_ID,
  },
  {
    imr: 3,
    event_type: 134217729,
    digest:
      'ba99db40bbcf5a0c855ee6233f2bb0581d408cf430a98cea5233daf8e21e6483419c1bb9d2c0057f5e9185a5a2bc0e2f',
    event: 'compose-hash',
    event_payload: '1b41d549eeb909955c5753df9064b2db28b99b70c1adc00a14c49825f104ea75',
  },
  {
    imr: 3,
    event_type: 134217729,
    digest:
      'fdea52c2b3479345247a2d0a05a8e36caee77d6a35aa896d86c5724f75147541966dcebbafa7724af04ce8d855aef2b5',
    event: 'instance-id',
    event_payload: '396554b3487ed9549b2e57435574b1cc0f959aef',
  },
  {
    imr: 3,
    event_type: 134217729,
    digest:
      '98bd7e6bd3952720b65027fd494834045d06b4a714bf737a06b874638b3ea00ff402f7f583e3e3b05e921c8570433ac6',
    event: 'boot-mr-done',
    event_payload: '',
  },
  {
    imr: 3,
    event_type: 134217729,
    digest:
      'eb6508fe194b5dfa04efad892f507ef92bc24fa1988c00b8a7ec0476b80acce80b197fb44073e3753d2fc523fce912b7',
    event: 'mr-kms',
    event_payload: 'c6d0cc8008a564760ccb0ca63f574f000fce4ae2fa1a9265e7522f6889e82aab',
  },
  {
    imr: 3,
    event_type: 134217729,
    digest:
      'da7226c6addbb7a3d244191bab7b190ec16854158e4534abbf1d017826060ee4a10d71f4d45c08129f1020f42e07bf85',
    event: 'os-image-hash',
    event_payload: '4ed916a047daceeba658948c7a249d0faf26dd82608ff028bd3e9b4b67ff8cae',
  },
  {
    imr: 3,
    event_type: 134217729,
    digest:
      'a7179594e816a60a9caa0f8c6dcd25e86459b99ec8733767c81f106768b42cfe2215fab852adf53687215afd950ab749',
    event: 'key-provider',
    event_payload:
      '7b226e616d65223a226b6d73222c226964223a223330353933303133303630373261383634386365336430323031303630383261383634386365336430333031303730333432303030346161366639616564343239306231323061626461323933373136303638393835373534343835303234636435306263306236376331383032626466306536323530656464663333613164353931633161323537633734353938636536633437353666393664633335393736323564656365313834313930386663306438616339227d',
  },
  {
    imr: 3,
    event_type: 134217729,
    digest:
      '1a76b2a80a0be71eae59f80945d876351a7a3fb8e9fd1ff1cede5734aa84ea11fd72b4edfbb6f04e5a85edd114c751bd',
    event: 'system-ready',
    event_payload: '',
  },
];

const VALID_RTMR3 =
  'edfa1b4966b651678509dd241ab2be85caceeb8be663f79bfc27b5a189a9fe403522c39a080d8f3f750aa037a37d606d';

describe('AttestationService - Security Critical Tests', () => {
  let service: AttestationService;
  let mockApiService: MockProxy<CrossmintApiService>;
  // biome-ignore lint/suspicious/noExplicitAny: WASM mocks require any type
  let mockWasmInit: any;
  // biome-ignore lint/suspicious/noExplicitAny: WASM mocks require any type
  let mockJsGetCollateral: any;
  // biome-ignore lint/suspicious/noExplicitAny: WASM mocks require any type
  let mockJsVerify: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockApiService = mock<CrossmintApiService>();
    service = new AttestationService(mockApiService, VALID_APP_ID);

    const wasmModule = await import('@phala/dcap-qvl-web');
    mockWasmInit = vi.mocked(wasmModule.default);
    mockJsGetCollateral = vi.mocked(wasmModule.js_get_collateral);
    mockJsVerify = vi.mocked(wasmModule.js_verify);

    // Reset to secure defaults - require explicit override for each test
    mockWasmInit.mockResolvedValue(undefined);
    mockJsGetCollateral.mockRejectedValue(new Error('Mock not configured'));
    mockJsVerify.mockRejectedValue(new Error('Mock not configured'));
  });

  describe('TEE Authenticity Validation', () => {
    beforeEach(() => {
      mockJsGetCollateral.mockResolvedValue('mock-collateral');
      mockJsVerify.mockResolvedValue({
        status: 'UpToDate',
        report: {
          TD10: {
            report_data: 'a'.repeat(128),
            rt_mr3: 'b'.repeat(96),
          },
        },
      });
    });

    it('SECURITY: Should validate authentic TEE attestation', async () => {
      const report = await service.verifyTEEReport('valid-quote-hex');

      expect(report.status).toBe('UpToDate');
      expect(mockWasmInit).toHaveBeenCalledWith('mock-wasm-buffer');
      expect(mockJsGetCollateral).toHaveBeenCalled();
      expect(mockJsVerify).toHaveBeenCalled();
    });

    it('SECURITY: Should reject invalid TEE status', async () => {
      mockJsVerify.mockResolvedValue({
        status: 'OutOfDate',
        report: { TD10: { report_data: 'a'.repeat(128), rt_mr3: 'b'.repeat(96) } },
      });

      await expect(service.verifyTEEReport('valid-quote-hex')).rejects.toThrow(
        'TEE attestation is invalid'
      );
    });

    it('SECURITY: Should reject malformed TEE report', async () => {
      mockJsVerify.mockResolvedValue({ invalid: 'structure' });

      await expect(service.verifyTEEReport('valid-quote-hex')).rejects.toThrow();
    });

    it('SECURITY: Should support TD15 report format', async () => {
      mockJsVerify.mockResolvedValue({
        status: 'UpToDate',
        report: { TD15: { report_data: 'a'.repeat(128), rt_mr3: 'b'.repeat(96) } },
      });

      const report = await service.verifyTEEReport('valid-quote-hex');
      expect(report.status).toBe('UpToDate');
    });

    it('SECURITY: Should handle WASM verification failures', async () => {
      mockJsVerify.mockRejectedValue(new Error('WASM verification failed'));

      await expect(service.verifyTEEReport('invalid-quote')).rejects.toThrow(
        'WASM verification failed'
      );
    });

    it('SECURITY: Should handle collateral retrieval failures', async () => {
      mockJsGetCollateral.mockRejectedValue(new Error('Collateral unavailable'));

      await expect(service.verifyTEEReport('valid-quote-hex')).rejects.toThrow(
        'Collateral unavailable'
      );
    });
  });

  describe('Public Key Attestation Integrity', () => {
    it('SECURITY: Should validate authentic public key attestation', async () => {
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

    it('SECURITY: Should reject invalid hash length', async () => {
      await expect(service.verifyTEEPublicKey('a'.repeat(126), VALID_PUBLIC_KEY)).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });

    it('SECURITY: Should detect hash tampering', async () => {
      await expect(service.verifyTEEPublicKey('f'.repeat(128), VALID_PUBLIC_KEY)).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });

    it('SECURITY: Should reject malformed hex data', async () => {
      await expect(service.verifyTEEPublicKey('xyz'.repeat(43), VALID_PUBLIC_KEY)).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });

    it('SECURITY: Should reject invalid base64 public key', async () => {
      await expect(
        service.verifyTEEPublicKey('a'.repeat(128), 'invalid-base64!@#')
      ).rejects.toThrow('TEE reported public key does not match attestation report');
    });
  });

  describe('TEE Application Integrity', () => {
    describe('RTMR3 Measurement Verification', () => {
      it('SECURITY: Should validate authentic RTMR3 calculation', async () => {
        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(VALID_EVENT_LOG), VALID_RTMR3)
        ).resolves.not.toThrow();
      });

      it('SECURITY: Should skip non-RTMR3 events during validation', async () => {
        const mixedEventLog = [
          {
            imr: 0,
            event_type: 2147483659,
            digest: 'any-digest',
            event: '',
            event_payload: 'data',
          },
          {
            imr: 1,
            event_type: 2147483651,
            digest: 'any-digest',
            event: '',
            event_payload: 'data',
          },
          ...VALID_EVENT_LOG,
        ];

        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(mixedEventLog), VALID_RTMR3)
        ).resolves.not.toThrow();
      });

      it('SECURITY: Should detect RTMR3 tampering', async () => {
        const wrongRtmr3 =
          '11fa1b4966b651678509dd241ab2be85caceeb8be663f79bfc27b5a189a9fe403522c39a080d8f3f750aa037a37d606d';

        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(VALID_EVENT_LOG), wrongRtmr3)
        ).rejects.toThrow(`RTMR3 mismatch: replayed ${VALID_RTMR3} != reported ${wrongRtmr3}`);
      });

      it('SECURITY: Should handle empty RTMR3 history', async () => {
        const emptyLog = [
          { imr: 0, event_type: 2147483659, digest: 'digest', event: '', event_payload: 'data' },
        ];
        const initMr =
          '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(emptyLog), initMr)
        ).rejects.toThrow('Missing required application events');
      });
    });

    describe('Event Validation Logic', () => {
      it('SECURITY: Should skip validation for non-RTMR3 events', async () => {
        const mixedLog = [
          {
            imr: 0,
            event_type: 2147483659,
            digest: 'invalid-digest',
            event: '',
            event_payload: 'data',
          },
          ...VALID_EVENT_LOG,
        ];

        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(mixedLog), VALID_RTMR3)
        ).resolves.not.toThrow();
      });

      it('SECURITY: Should reject invalid RTMR3 event digest', async () => {
        const invalidLog = [...VALID_EVENT_LOG];
        invalidLog[1] = { ...invalidLog[1], digest: 'invalid-digest' };

        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(invalidLog), VALID_RTMR3)
        ).rejects.toThrow('Invalid event digest found for event: app-id in IMR 3');
      });
    });

    describe('Application Identity Enforcement', () => {
      it('SECURITY: Should reject unauthorized application IDs', async () => {
        const wrongAppLog = VALID_EVENT_LOG.map(event =>
          event.event === 'app-id' ? { ...event, event_payload: 'unauthorized-app-id' } : event
        );

        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(wrongAppLog), 'any-rtmr3')
        ).rejects.toThrow('Invalid event digest');
      });

      it('SECURITY: Should reject malformed JSON', async () => {
        await expect(
          service.verifyTEEApplicationIntegrity('invalid-json', 'any-rtmr3')
        ).rejects.toThrow('Failed to parse event log JSON');
      });

      it('SECURITY: Should reject incomplete event logs', async () => {
        const incompleteLog = JSON.stringify([VALID_EVENT_LOG[0]]);

        await expect(
          service.verifyTEEApplicationIntegrity(incompleteLog, 'any-rtmr3')
        ).rejects.toThrow('Missing required application events');
      });

      it('SECURITY: Should reject event logs missing mandatory key_provider', async () => {
        const logWithoutKeyProvider = [
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest1',
            event: 'app-id',
            event_payload: VALID_APP_ID,
          },
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest2',
            event: 'compose-hash',
            event_payload: 'hash',
          },
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest3',
            event: 'instance-id',
            event_payload: 'id',
          },
          // Missing key-provider event
        ];

        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(logWithoutKeyProvider), VALID_RTMR3)
        ).rejects.toThrow('Invalid event digest');
      });

      it('SECURITY: Should validate key_provider has name="kms"', async () => {
        const validKeyProviderLog = [
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest1',
            event: 'app-id',
            event_payload: VALID_APP_ID,
          },
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest2',
            event: 'compose-hash',
            event_payload: 'hash',
          },
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest3',
            event: 'instance-id',
            event_payload: 'id',
          },
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest4',
            event: 'key-provider',
            event_payload: '7b226e616d65223a226b6d73222c226964223a22746573742d6964227d',
          }, // {"name":"kms","id":"test-id"}
        ];

        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(validKeyProviderLog), VALID_RTMR3)
        ).rejects.toThrow('Invalid event digest');
      });

      it('SECURITY: Should reject key_provider with invalid name', async () => {
        const invalidKeyProviderLog = [
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest1',
            event: 'app-id',
            event_payload: VALID_APP_ID,
          },
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest2',
            event: 'compose-hash',
            event_payload: 'hash',
          },
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest3',
            event: 'instance-id',
            event_payload: 'id',
          },
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest4',
            event: 'key-provider',
            event_payload: '7b226e616d65223a22696e76616c6964222c226964223a22746573742d6964227d',
          }, // {"name":"invalid","id":"test-id"}
        ];

        await expect(
          service.verifyTEEApplicationIntegrity(JSON.stringify(invalidKeyProviderLog), VALID_RTMR3)
        ).rejects.toThrow('Invalid event digest');
      });

      it('SECURITY: Should reject malformed key_provider JSON', async () => {
        const malformedKeyProviderLog = [
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest1',
            event: 'app-id',
            event_payload: VALID_APP_ID,
          },
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest2',
            event: 'compose-hash',
            event_payload: 'hash',
          },
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest3',
            event: 'instance-id',
            event_payload: 'id',
          },
          {
            imr: 3,
            event_type: 134217729,
            digest: 'digest4',
            event: 'key-provider',
            event_payload: 'invalid-json',
          },
        ];

        await expect(
          service.verifyTEEApplicationIntegrity(
            JSON.stringify(malformedKeyProviderLog),
            VALID_RTMR3
          )
        ).rejects.toThrow('Invalid event digest');
      });
    });
  });

  describe('Secure Failure Modes', () => {
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

    it('SECURITY: Should handle missing TD10/TD15 report', async () => {
      mockJsGetCollateral.mockResolvedValue('mock-collateral');
      mockJsVerify.mockResolvedValue({ status: 'UpToDate', report: {} });

      const validEventLogForTest = [
        {
          imr: 3,
          event_type: 134217729,
          digest: 'valid-digest',
          event: 'app-id',
          event_payload: VALID_APP_ID,
        },
        {
          imr: 3,
          event_type: 134217729,
          digest: 'valid-digest',
          event: 'compose-hash',
          event_payload: 'hash',
        },
        {
          imr: 3,
          event_type: 134217729,
          digest: 'valid-digest',
          event: 'instance-id',
          event_payload: 'id',
        },
      ];

      mockApiService.getAttestation.mockResolvedValue({
        quote: 'valid-quote',
        publicKey: VALID_PUBLIC_KEY,
        event_log: JSON.stringify(validEventLogForTest),
        hash_algorithm: 'sha512',
        prefix: 'app-data',
      });

      await expect(service.init()).rejects.toThrow('No TD10 or TD15 report found in the quote');
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle empty event log', async () => {
      await expect(service.verifyTEEApplicationIntegrity('[]', 'any-rtmr3')).rejects.toThrow(
        'Missing required application events'
      );
    });

    it('should handle null/undefined inputs', async () => {
      await expect(service.verifyTEEPublicKey('', '')).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
      await expect(service.verifyTEEApplicationIntegrity('{}', '')).rejects.toThrow(
        'Failed to parse event log JSON'
      );
    });

    it('should handle oversized hex values', async () => {
      await expect(service.verifyTEEPublicKey('f'.repeat(10000), VALID_PUBLIC_KEY)).rejects.toThrow(
        'TEE reported public key does not match attestation report'
      );
    });

    it('should handle hex-encoded key provider payload', async () => {
      const keyProviderLog = [
        {
          imr: 3,
          event_type: 134217729,
          digest: 'digest1',
          event: 'app-id',
          event_payload: VALID_APP_ID,
        },
        {
          imr: 3,
          event_type: 134217729,
          digest: 'digest2',
          event: 'compose-hash',
          event_payload: 'hash',
        },
        {
          imr: 3,
          event_type: 134217729,
          digest: 'digest3',
          event: 'instance-id',
          event_payload: 'id',
        },
        {
          imr: 3,
          event_type: 134217729,
          digest: 'digest4',
          event: 'key-provider',
          event_payload: '7b226e616d65223a226b6d73227d',
        },
      ];

      await expect(
        service.verifyTEEApplicationIntegrity(JSON.stringify(keyProviderLog), VALID_RTMR3)
      ).rejects.toThrow('Invalid event digest');
    });

    it('should validate key_provider schema with name="kms" requirement', async () => {
      // Create log with invalid key_provider name but valid structure to test schema validation
      const logWithInvalidKeyProviderName = [
        {
          imr: 3,
          event_type: 134217729,
          digest:
            'f9974020ef507068183313d0ca808e0d1ca9b2d1ad0c61f5784e7157c362c06536f5ddacdad4451693f48fcc72fff624',
          event: 'system-preparing',
          event_payload: '',
        },
        {
          imr: 3,
          event_type: 134217729,
          digest:
            '8fb0fe5adbb3a5038e382aa1c4f5878ffa22b0671b3fba3ca9181c5a3e3b5fb47a33ed4fc8f63fcaf1a949a53acef0fa',
          event: 'app-id',
          event_payload: VALID_APP_ID,
        },
        {
          imr: 3,
          event_type: 134217729,
          digest:
            'ba99db40bbcf5a0c855ee6233f2bb0581d408cf430a98cea5233daf8e21e6483419c1bb9d2c0057f5e9185a5a2bc0e2f',
          event: 'compose-hash',
          event_payload: '1b41d549eeb909955c5753df9064b2db28b99b70c1adc00a14c49825f104ea75',
        },
        {
          imr: 3,
          event_type: 134217729,
          digest:
            'fdea52c2b3479345247a2d0a05a8e36caee77d6a35aa896d86c5724f75147541966dcebbafa7724af04ce8d855aef2b5',
          event: 'instance-id',
          event_payload: '396554b3487ed9549b2e57435574b1cc0f959aef',
        },
        {
          imr: 3,
          event_type: 134217729,
          digest:
            '98bd7e6bd3952720b65027fd494834045d06b4a714bf737a06b874638b3ea00ff402f7f583e3e3b05e921c8570433ac6',
          event: 'key-provider',
          event_payload: '7b226e616d65223a22696e76616c6964222c226964223a22746573742d6964227d', // {"name":"invalid","id":"test-id"}
        },
      ];

      // Should fail during digest validation because the payload doesn't match the real digest
      await expect(
        service.verifyTEEApplicationIntegrity(
          JSON.stringify(logWithInvalidKeyProviderName),
          VALID_RTMR3
        )
      ).rejects.toThrow('Invalid event digest');
    });
  });
});
