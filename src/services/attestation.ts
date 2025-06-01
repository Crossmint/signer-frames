import type { CrossmintApiService } from './api';
import { XMIFService } from './service';
import init, { js_get_collateral, js_verify } from '@phala/dcap-qvl-web';
import wasm from '@phala/dcap-qvl-web/dcap-qvl-web_bg.wasm';
import { decodeBytes, encodeBytes } from './utils';
import { z } from 'zod';
import { isDevelopment } from './environment';

const PCCS_URL = 'https://pccs.phala.network/tdx/certification/v4';
const ATTESTATION_VERIFIED_STATUS = 'UpToDate';
const TEE_REPORT_DATA_PREFIX = 'app-data:';
const TEE_REPORT_DATA_HASH = 'SHA-512' as const;

// RTMR3 calculation constants
const INIT_MR = '0'.repeat(96);
const DSTACK_EVENT_TAG = 0x08000001;
const EXPECTED_APP_ID = '0ade7b12204222a684b6e8e26aa5223f38e90725';

const AttestationReportSchema = z.object({
  status: z.string(),
  report: z.object({
    TD10: z.object({
      report_data: z.string(),
      rt_mr3: z.string(),
    }),
  }),
});

// Event log schemas
const EventLogEntrySchema = z.object({
  imr: z.number(),
  event_type: z.number(),
  digest: z.string(),
  event: z.string(),
  event_payload: z.string(),
});

const EventLogSchema = z.array(EventLogEntrySchema);

const HashEventSchema = z.object({
  rootfs_hash: z.string(),
  app_id: z.string(),
  compose_hash: z.string(),
  ca_cert_hash: z.string(),
  instance_id: z.string(),
});

type HashEvent = z.infer<typeof HashEventSchema>;

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

  async verifyAttestationAndParseKey(): Promise<string> {
    const attestation = await this.api.getAttestation();
    this.log('TEE attestation document fetched');

    await init(wasm);

    const decodedQuote = decodeBytes(attestation.quote, 'hex');
    const collateral = await js_get_collateral(PCCS_URL, decodedQuote);
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const report = await js_verify(decodedQuote, collateral, currentTime);

    const validatedReport = AttestationReportSchema.parse(report);

    if (validatedReport.status !== ATTESTATION_VERIFIED_STATUS) {
      throw new Error('TEE attestation is invalid');
    }

    const eventLogHashes = this.parseEventLogHashes(attestation.event_log);
    const calculatedRtmr3 = await this.calculateRtmr3FromHashes(eventLogHashes);
    const reportedRtmr3 = validatedReport.report.TD10.rt_mr3;

    if (calculatedRtmr3 !== reportedRtmr3) {
      throw new Error(`RTMR3 mismatch: calculated ${calculatedRtmr3} != reported ${reportedRtmr3}`);
    }

    this.validateEventLogValues(eventLogHashes);

    const publicKeyIsAttested = await this.verifyReportAttestsPublicKey(
      validatedReport.report.TD10.report_data,
      attestation.publicKey
    );

    if (!publicKeyIsAttested) {
      throw new Error('TEE reported public key does not match attestation report');
    }

    this.log('TEE attestation document fully validated! Continuing...');
    return attestation.publicKey;
  }

  async getPublicKeyDevMode(): Promise<string> {
    const response = await this.api.getPublicKey();
    return response.publicKey;
  }

  async verifyReportAttestsPublicKey(reportData: string, publicKey: string): Promise<boolean> {
    try {
      const reportDataHash = decodeBytes(reportData, 'hex');
      if (reportDataHash.length !== 64) {
        return false;
      }

      const prefixBytes = new TextEncoder().encode(TEE_REPORT_DATA_PREFIX);
      const publicKeyBytes = decodeBytes(publicKey, 'base64');
      const reconstructedReportData = new Uint8Array(prefixBytes.length + publicKeyBytes.length);
      reconstructedReportData.set(prefixBytes, 0);
      reconstructedReportData.set(publicKeyBytes, prefixBytes.length);

      const hash = await crypto.subtle.digest(TEE_REPORT_DATA_HASH, reconstructedReportData);
      const hashView = new Uint8Array(hash);
      return hashView.every((byte, i) => byte === reportDataHash[i]);
    } catch (error) {
      return false;
    }
  }

  private parseEventLogHashes(eventLogJson: string): HashEvent {
    const eventLog = EventLogSchema.parse(JSON.parse(eventLogJson));

    const hashEvents = eventLog.filter(
      entry =>
        entry.imr === 3 &&
        entry.event_type === 134217729 &&
        ['rootfs-hash', 'app-id', 'compose-hash', 'ca-cert-hash', 'instance-id'].includes(
          entry.event
        )
    );

    const hashes: Partial<HashEvent> = {};

    for (const entry of hashEvents) {
      switch (entry.event) {
        case 'rootfs-hash':
          hashes.rootfs_hash = entry.event_payload;
          break;
        case 'app-id':
          hashes.app_id = entry.event_payload;
          break;
        case 'compose-hash':
          hashes.compose_hash = entry.event_payload;
          break;
        case 'ca-cert-hash':
          hashes.ca_cert_hash = entry.event_payload;
          break;
        case 'instance-id':
          hashes.instance_id = entry.event_payload;
          break;
      }
    }

    return HashEventSchema.parse(hashes);
  }

  private validateEventLogValues(hashes: HashEvent): void {
    if (hashes.app_id !== EXPECTED_APP_ID) {
      throw new Error(`Invalid app ID: expected ${EXPECTED_APP_ID}, got ${hashes.app_id}`);
    }
  }

  private async calculateRtmr3FromHashes(hashes: HashEvent): Promise<string> {
    const rootfsDigest = await this.calculateDigest('rootfs-hash', hashes.rootfs_hash);
    const appIdDigest = await this.calculateDigest('app-id', hashes.app_id);
    const composeDigest = await this.calculateDigest('compose-hash', hashes.compose_hash);
    const caCertDigest = await this.calculateDigest('ca-cert-hash', hashes.ca_cert_hash);
    const instanceIdDigest = await this.calculateDigest('instance-id', hashes.instance_id);

    return await this.replayRtmrHistory([
      rootfsDigest,
      appIdDigest,
      composeDigest,
      caCertDigest,
      instanceIdDigest,
    ]);
  }

  private async calculateDigest(eventName: string, eventValue: string): Promise<string> {
    const eventNameBytes = new TextEncoder().encode(eventName);
    const eventValueBytes = decodeBytes(eventValue, 'hex');
    const colonByte = new TextEncoder().encode(':');

    const totalLength = 4 + 1 + eventNameBytes.length + 1 + eventValueBytes.length;
    const buffer = new ArrayBuffer(totalLength);
    const view = new Uint8Array(buffer);

    let offset = 0;

    const tagBytes = new Uint8Array(4);
    tagBytes[0] = DSTACK_EVENT_TAG & 0xff;
    tagBytes[1] = (DSTACK_EVENT_TAG >> 8) & 0xff;
    tagBytes[2] = (DSTACK_EVENT_TAG >> 16) & 0xff;
    tagBytes[3] = (DSTACK_EVENT_TAG >> 24) & 0xff;
    view.set(tagBytes, offset);
    offset += 4;

    view.set(colonByte, offset);
    offset += 1;

    view.set(eventNameBytes, offset);
    offset += eventNameBytes.length;

    view.set(colonByte, offset);
    offset += 1;

    view.set(eventValueBytes, offset);

    const hashBuffer = await crypto.subtle.digest('SHA-384', buffer);
    return encodeBytes(new Uint8Array(hashBuffer), 'hex');
  }

  private async replayRtmrHistory(history: string[]): Promise<string> {
    if (history.length === 0) {
      return INIT_MR;
    }

    let mr = decodeBytes(INIT_MR, 'hex');

    for (const content of history) {
      let contentBytes = decodeBytes(content, 'hex');

      if (contentBytes.length < 48) {
        const paddedBytes = new Uint8Array(48);
        paddedBytes.set(contentBytes, 0);
        contentBytes = paddedBytes;
      }

      const combined = new Uint8Array(mr.length + contentBytes.length);
      combined.set(mr, 0);
      combined.set(contentBytes, mr.length);

      const hashBuffer = await crypto.subtle.digest('SHA-384', combined);
      mr = new Uint8Array(hashBuffer);
    }

    return encodeBytes(mr, 'hex');
  }
}
