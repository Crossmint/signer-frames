import type { CrossmintApiService } from './api';
import { XMIFService } from './service';
import init, { js_get_collateral, js_verify } from '@phala/dcap-qvl-web';
import wasm from '@phala/dcap-qvl-web/dcap-qvl-web_bg.wasm';
import { decodeBytes } from './utils';
import { z } from 'zod';
import { isDevelopment } from './environment';

const PCCS_URL = 'https://pccs.phala.network/tdx/certification/v4';
const ATTESTATION_VERIFIED_STATUS = 'UpToDate';
const TEE_REPORT_DATA_PREFIX = 'app-data:';
const TEE_REPORT_DATA_HASH = 'SHA-512' as const;

// Minimal TEE report validation schema
const AttestationReportSchema = z.object({
  status: z.string(),
  advisory_ids: z.array(z.string()),
  report: z.object({
    TD10: z.object({
      tee_tcb_svn: z.string(),
      mr_seam: z.string(),
      mr_signer_seam: z.string(),
      seam_attributes: z.string(),
      td_attributes: z.string(),
      xfam: z.string(),
      mr_td: z.string(),
      mr_config_id: z.string(),
      mr_owner: z.string(),
      mr_owner_config: z.string(),
      rt_mr0: z.string(),
      rt_mr1: z.string(),
      rt_mr2: z.string(),
      rt_mr3: z.string(),
      report_data: z.string(),
    }),
  }),
});
export class AttestationService extends XMIFService {
  name = 'Attestation Service';
  log_prefix = '[AttestationService]';

  constructor(private readonly api: CrossmintApiService) {
    super();
  }

  // This being not null implicitly assumes validation
  private publicKey: string | null = null;

  async init() {
    try {
      if (isDevelopment()) {
        this.publicKey = await this.getPublicKeyDevMode();
        return;
      }

      this.publicKey = await this.verifyAttestationAndParseKey();
    } catch (e: unknown) {
      this.logError('Failed to validate attestation document! This error is not recoverable');
      this.publicKey = null;
      throw e;
    }
  }

  async getAttestedPublicKey(): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Attestation service has not been initialized!');
    }

    return this.publicKey;
  }

  private async verifyAttestationAndParseKey(): Promise<string> {
    const attestation = await this.api.getAttestation();
    this.log('TEE attestation document fetched', JSON.stringify(attestation, null, 2));

    await init(wasm);

    const decodedQuote = decodeBytes(attestation.quote, 'hex');
    const collateral = await js_get_collateral(PCCS_URL, decodedQuote);

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const report = await js_verify(decodedQuote, collateral, currentTime);
    const validatedReport = AttestationReportSchema.parse(report);

    if (validatedReport.status !== ATTESTATION_VERIFIED_STATUS) {
      throw new Error('TEE attestation is invalid');
    }

    const publicKeyIsAttested = await this.reportAttestsPublicKey(
      validatedReport.report.TD10.report_data,
      attestation.publicKey
    );

    if (!publicKeyIsAttested) {
      throw new Error('TEE reported public key does not match attestation report');
    }

    this.log('TEE attestation document validated! Continuing...');
    return attestation.publicKey;
  }

  private async getPublicKeyDevMode(): Promise<string> {
    const response = await this.api.getPublicKey();
    return response.publicKey;
  }

  private async reportAttestsPublicKey(reportData: string, publicKey: string): Promise<boolean> {
    const ReportDataHash = decodeBytes(reportData, 'hex');

    const prefixBytes = new TextEncoder().encode(TEE_REPORT_DATA_PREFIX);
    const publicKeyBytes = decodeBytes(publicKey, 'base64');
    const reconstructedReportData = new Uint8Array(prefixBytes.length + publicKeyBytes.length);
    reconstructedReportData.set(prefixBytes, 0);
    reconstructedReportData.set(publicKeyBytes, prefixBytes.length);

    const hash = await crypto.subtle.digest(TEE_REPORT_DATA_HASH, reconstructedReportData);
    const hashView = new Uint8Array(hash);
    return hashView.every((byte, i) => byte === ReportDataHash[i]);
  }
}
