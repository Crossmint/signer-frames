import type { CrossmintApiService } from './api';
import { XMIFService } from './service';
import init, { js_get_collateral, js_verify } from '@phala/dcap-qvl-web';
import wasm from '@phala/dcap-qvl-web/dcap-qvl-web_bg.wasm';
import { decodeBytes, encodeBytes } from './utils';
import { z } from 'zod';
import { isDevelopment } from './environment';

// TEE Quote Verification using Phala's DCAP QVL library
const PCCS_URL = 'https://pccs.phala.network/tdx/certification/v4';
const ATTESTATION_VERIFIED_STATUS = 'UpToDate';
const TEE_REPORT_DATA_PREFIX = 'app-data:';
const TEE_REPORT_DATA_HASH = 'SHA-512' as const;

// RTMR3 calculation constants - Based on DStack TEE implementations
const INIT_MR = '0'.repeat(96);
const DSTACK_EVENT_TAG = 0x08000001; // Event type, taken from DStack source code
const EXPECTED_APP_ID = '0ade7b12204222a684b6e8e26aa5223f38e90725';

// Event log filtering constants
const EVENT_LOG_IMR = 3;
const EVENT_LOG_TYPE = 134217729;
const RTMR3_HASH_ALGORITHM = 'SHA-384';
const SHA512_HASH_LENGTH = 64;
const SHA384_HASH_LENGTH = 48;

// Event name mappings for RTMR3 calculation
const EVENT_NAMES = {
  ROOTFS_HASH: 'rootfs-hash',
  APP_ID: 'app-id',
  COMPOSE_HASH: 'compose-hash',
  CA_CERT_HASH: 'ca-cert-hash',
  INSTANCE_ID: 'instance-id',
} as const;

// Event to property mapping for efficient parsing
const EVENT_PROPERTY_MAP: Record<string, keyof HashEvent> = {
  [EVENT_NAMES.ROOTFS_HASH]: 'rootfs_hash',
  [EVENT_NAMES.APP_ID]: 'app_id',
  [EVENT_NAMES.COMPOSE_HASH]: 'compose_hash',
  [EVENT_NAMES.CA_CERT_HASH]: 'ca_cert_hash',
  [EVENT_NAMES.INSTANCE_ID]: 'instance_id',
};

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

      const attestation = await this.api.getAttestation();
      this.log('TEE attestation document fetched');

      this.log('Verifying intel TDX quote');
      const validatedReport = await this.verifyTEEReport(attestation.quote);

      this.log('Verifying TEE application integrity');
      await this.verifyTEEApplicationIntegrity(
        attestation.event_log,
        validatedReport.report.TD10.rt_mr3
      );

      this.log('Verifying relay reported public key');
      await this.verifyTEEPublicKey(validatedReport.report.TD10.report_data, attestation.publicKey);

      this.publicKey = attestation.publicKey;
      this.log('TEE attestation document fully validated! Continuing...');
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

  /**
   * Verifies the Intel TDX TEE attestation report using WASM-based quote verification.
   *
   * This method performs the core hardware attestation validation by:
   * 1. Initializing the Intel DCAP Quote Verification Library (WASM)
   * 2. Decoding the attestation quote from hexadecimal format
   * 3. Retrieving cryptographic collateral from Intel's PCCS service
   * 4. Verifying the quote authenticity and recency using Intel's verification logic
   * 5. Validating that the TEE attestation status is current and trusted
   *
   * The verification process cryptographically proves that:
   * - The code is running in a genuine Intel TDX Trusted Execution Environment
   * - The TEE measurements and configuration are authentic and unmodified
   * - The attestation was generated recently (prevents replay attacks)
   *
   * @param quote - Base64-encoded Intel TDX attestation quote containing TEE measurements
   * @returns Promise resolving to validated attestation report with TEE measurements and status
   * @throws {Error} When WASM initialization fails
   * @throws {Error} When quote verification fails or collateral retrieval fails
   * @throws {Error} When TEE attestation status is not 'UpToDate' (indicating untrusted TEE)
   */
  public async verifyTEEReport(quote: string) {
    await init(wasm);

    const decodedQuote = decodeBytes(quote, 'hex');
    const collateral = await js_get_collateral(PCCS_URL, decodedQuote);
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const report = await js_verify(decodedQuote, collateral, currentTime);

    const validatedReport = AttestationReportSchema.parse(report);

    if (validatedReport.status !== ATTESTATION_VERIFIED_STATUS) {
      throw new Error('TEE attestation is invalid');
    }

    return validatedReport;
  }

  /**
   * Verifies TEE application integrity through RTMR3 measurement validation and application identity enforcement.
   *
   * This method ensures that the specific application running in the TEE is authorized and unmodified by:
   * 1. Parsing the TEE event log to extract cryptographic hashes of system components
   * 2. Calculating the expected RTMR3 (Runtime Measurement Register 3) value from event history
   * 3. Comparing calculated RTMR3 against the value reported by the TEE hardware
   * 4. Validating that the application ID matches the expected authorized application
   *
   * RTMR3 provides a cryptographic chain of trust by measuring:
   * - Root filesystem integrity (rootfs-hash)
   * - Application identity and version (app-id)
   * - Docker composition configuration (compose-hash)
   * - Certificate authority trust chain (ca-cert-hash)
   * - Unique instance identifier (instance-id)
   *
   * Any modification to these components will result in a different RTMR3 value,
   * preventing execution of unauthorized or tampered applications.
   *
   * @param eventLogJson - JSON string containing TEE event log with component measurements
   * @param reportedRtmr3 - RTMR3 value reported by TEE hardware for comparison
   * @returns Promise that resolves if integrity validation passes
   * @throws {Error} When event log JSON is malformed or missing required events
   * @throws {Error} When calculated RTMR3 doesn't match reported value (indicates tampering)
   * @throws {Error} When application ID doesn't match expected authorized application
   * @throws {Error} When cryptographic hash calculation fails
   */
  public async verifyTEEApplicationIntegrity(
    eventLogJson: string,
    reportedRtmr3: string
  ): Promise<void> {
    const eventLogHashes = this.parseEventLogHashes(eventLogJson);
    const calculatedRtmr3 = await this.calculateRtmr3FromHashes(eventLogHashes);

    if (calculatedRtmr3 !== reportedRtmr3) {
      throw new Error(`RTMR3 mismatch: calculated ${calculatedRtmr3} != reported ${reportedRtmr3}`);
    }

    this.validateEventLogValues(eventLogHashes);
  }

  /**
   * Verifies that the TEE attestation report cryptographically commits to the provided public key.
   *
   * This method establishes the critical link between the TEE hardware attestation and the
   * TEE's public key, which if left unchecked, may otherwise be modified by the system Relay, by:
   * 1. Extracting the report_data field from the TEE attestation
   * 2. Reconstructing the expected report_data by hashing 'app-data:' prefix + public key
   * 3. Comparing the reconstructed hash with the TEE-reported hash byte-by-byte
   *
   * The TEE report_data field contains a SHA-512 hash that was generated inside the TEE,
   * proving that the TEE had access to the public key during attestation generation.
   * This prevents key substitution attacks where a malicious Relay might try to use a different
   * public key than the one actually protected by the TEE.
   *
   * The 'app-data:' prefix ensures that the hash is application-specific and prevents
   * hash collision attacks using other data structures.
   *
   * @param reportData - Hexadecimal TEE report_data containing hash of attested public key
   * @param publicKey - Base64-encoded public key that should be attested by the TEE
   * @returns Promise that resolves if the key has been cryptographically verified by the TEE
   * @throws {Error} When cryptographic hash calculation fails
   * @throws {Error} When report_data length is invalid (not 64 bytes for SHA-512)
   */
  public async verifyTEEPublicKey(reportData: string, publicKey: string): Promise<void> {
    const publicKeyIsAttested = await this.verifyReportAttestsPublicKey(reportData, publicKey);

    if (!publicKeyIsAttested) {
      throw new Error('TEE reported public key does not match attestation report');
    }
  }

  private async getPublicKeyDevMode(): Promise<string> {
    const response = await this.api.getPublicKey();
    return response.publicKey;
  }

  private async verifyReportAttestsPublicKey(
    reportData: string,
    publicKey: string
  ): Promise<boolean> {
    try {
      const reportDataHash = decodeBytes(reportData, 'hex');
      if (reportDataHash.length !== SHA512_HASH_LENGTH) {
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
        entry.imr === EVENT_LOG_IMR &&
        entry.event_type === EVENT_LOG_TYPE &&
        Object.prototype.hasOwnProperty.call(EVENT_PROPERTY_MAP, entry.event)
    );

    const hashes: Partial<HashEvent> = {};

    for (const entry of hashEvents) {
      const property = EVENT_PROPERTY_MAP[entry.event];
      if (property) {
        hashes[property] = entry.event_payload;
      }
    }

    return HashEventSchema.parse(hashes);
  }

  private validateEventLogValues(hashes: HashEvent): void {
    if (hashes.app_id !== EXPECTED_APP_ID) {
      throw new Error(`Invalid app ID: expected ${EXPECTED_APP_ID}, got ${hashes.app_id}`);
    }
  }

  /**
   * Calculate the RTMR3 value from the given hash values.
   *
   * Replicates this code from DStack:
   * https://github.com/Dstack-TEE/dstack/blob/master/tdxctl/src/fde_setup.rs#L437
   *
   * @param hashes - Object containing all required hash values for RTMR3 calculation
   * @returns Promise resolving to the calculated RTMR3 value as a hexadecimal string
   */
  private async calculateRtmr3FromHashes(hashes: HashEvent): Promise<string> {
    const rootfsDigest = await this.calculateDigest(EVENT_NAMES.ROOTFS_HASH, hashes.rootfs_hash);
    const appIdDigest = await this.calculateDigest(EVENT_NAMES.APP_ID, hashes.app_id);
    const composeDigest = await this.calculateDigest(EVENT_NAMES.COMPOSE_HASH, hashes.compose_hash);
    const caCertDigest = await this.calculateDigest(EVENT_NAMES.CA_CERT_HASH, hashes.ca_cert_hash);
    const instanceIdDigest = await this.calculateDigest(
      EVENT_NAMES.INSTANCE_ID,
      hashes.instance_id
    );

    return await this.replayRtmrHistory([
      rootfsDigest,
      appIdDigest,
      composeDigest,
      caCertDigest,
      instanceIdDigest,
    ]);
  }

  /**
   * Calculate the digest for a given event name and value.
   *
   * Replicates this code from DStack:
   * https://github.com/Dstack-TEE/dstack/blob/master/cc-eventlog/src/lib.rs#L54-L63
   *
   * @param eventName - Name of the event (e.g., 'rootfs-hash', 'app-id')
   * @param eventValue - Hexadecimal value of the event
   * @returns Promise resolving to the calculated digest as a hexadecimal string
   */
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

    const hashBuffer = await crypto.subtle.digest(RTMR3_HASH_ALGORITHM, buffer);
    return encodeBytes(new Uint8Array(hashBuffer), 'hex');
  }

  /**
   * Replay the event history to calculate the current RTMR value.
   *
   * Taken from DStack Python SDK:
   * https://github.com/Dstack-TEE/dstack/blob/master/python/tappd_client/tappd_client.py#L49
   *
   * @param history - List of digest values to be used to calculate RTMR value
   * @returns Promise resolving to the calculated RTMR value as a hexadecimal string
   */
  private async replayRtmrHistory(history: string[]): Promise<string> {
    if (history.length === 0) {
      return INIT_MR;
    }

    let mr = decodeBytes(INIT_MR, 'hex');

    for (const content of history) {
      let contentBytes = decodeBytes(content, 'hex');

      if (contentBytes.length < SHA384_HASH_LENGTH) {
        const paddedBytes = new Uint8Array(SHA384_HASH_LENGTH);
        paddedBytes.set(contentBytes, 0);
        contentBytes = paddedBytes;
      }

      const combined = new Uint8Array(mr.length + contentBytes.length);
      combined.set(mr, 0);
      combined.set(contentBytes, mr.length);

      const hashBuffer = await crypto.subtle.digest(RTMR3_HASH_ALGORITHM, combined);
      mr = new Uint8Array(hashBuffer);
    }

    return encodeBytes(mr, 'hex');
  }
}
