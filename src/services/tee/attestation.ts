import type { CrossmintApiService } from '../api';
import { CrossmintFrameService } from '../service';
import init, { js_get_collateral, js_verify } from '@phala/dcap-qvl-web';
import wasm from '@phala/dcap-qvl-web/dcap-qvl-web_bg.wasm';
import { decodeBytes, encodeBytes } from '../common/utils';
import { z } from 'zod';
import { isDevelopment } from '../api';

// TEE Quote Verification using Phala's DCAP QVL library
const PCCS_URL = 'https://pccs.phala.network/tdx/certification/v4';
const ATTESTATION_VERIFIED_STATUS = 'UpToDate';
const TEE_REPORT_DATA_PREFIX = 'app-data:';
const TEE_REPORT_DATA_HASH = 'SHA-512' as const;

// RTMR calculation constants - Based on DStack TEE implementations
const INIT_MR =
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

// Event log filtering constants for RTMR3
const RTMR3_IMR_INDEX = 3;
const RTMR3_HASH_ALGORITHM = 'SHA-384';
const SHA512_HASH_LENGTH = 64;
const SHA384_HASH_LENGTH = 48;

// Event name mappings for application info extraction
const EVENT_NAMES = {
  APP_ID: 'app-id',
  COMPOSE_HASH: 'compose-hash',
  INSTANCE_ID: 'instance-id',
  KEY_PROVIDER: 'key-provider',
} as const;

const AttestationReportSchema = z.object({
  status: z.string(),
  report: z.object({
    TD10: z
      .object({
        report_data: z.string(),
        rt_mr3: z.string(),
      })
      .optional(),
    TD15: z
      .object({
        report_data: z.string(),
        rt_mr3: z.string(),
      })
      .optional(),
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

const KeyProviderSchema = z.object({
  name: z.literal('kms'),
  id: z.string(),
});

const ApplicationInfoSchema = z.object({
  app_id: z.string(),
  compose_hash: z.string(),
  instance_id: z.string(),
  key_provider: KeyProviderSchema,
});

type EventLogEntry = z.infer<typeof EventLogEntrySchema>;
type ApplicationInfo = z.infer<typeof ApplicationInfoSchema>;

/**
 * TEE Attestation Service for DStack Applications
 *
 * This service performs remote attestation for DStack TEE applications by:
 * 1. Verifying Intel TDX quotes using Phala's DCAP QVL library
 * 2. Validating application integrity through RTMR3 measurement replay
 * 3. Ensuring cryptographic commitment to the TEE's public key
 *
 * By doing so it ensures this iframe only interacts with and encrypts
 * sensitive data to a TEE running the authorized application code that
 * completes this system.
 *
 * The implementation is based on the reference attestation verification code
 * provided by the Phala team for DStack applications:
 * https://github.com/Dstack-TEE/dstack-examples/blob/main/attestation/rtmr3-based/verify.py
 *
 */
export class AttestationService extends CrossmintFrameService {
  name = 'Attestation Service';
  log_prefix = '[AttestationService]';

  constructor(
    private readonly api: CrossmintApiService,
    private readonly expectedAppId: string
  ) {
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

      this.log('Extracting TD report data and RTMR3');
      const { report_data, rt_mr3 } = this.extractTD(validatedReport);

      this.log('Verifying TEE application integrity');
      await this.verifyTEEApplicationIntegrity(attestation.event_log, rt_mr3);

      this.log('Verifying relay reported public key');
      await this.verifyTEEPublicKey(report_data, attestation.publicKey);

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
   * 3. Retrieving cryptographic collateral from Phala's PCCS service
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
   * This method implements the DStack attestation approach by:
   * 1. Parsing and validating the TEE event log to ensure integrity of RTMR3 events
   * 2. Extracting application information (app ID, compose hash, instance ID) from validated events
   * 3. Replaying RTMR3 calculation from validated event digests
   * 4. Comparing replayed RTMR3 against the value reported by the TEE hardware
   * 5. Validating that the application ID matches the expected authorized application
   *
   * The validation approach follows the reference implementation provided by the Dstack authors
   * https://github.com/Dstack-TEE/dstack-examples/blob/main/attestation/rtmr3-based/verify.py
   *
   * Only RTMR3 events are validated, as other IMR registers may have different validation rules.
   * Event validation uses the format: sha384(event_type:event_name:event_payload)
   *
   * Any modification to application components or tampering with event logs will result in
   * validation failures, preventing execution of unauthorized or tampered applications.
   *
   * @param eventLogJson - JSON string containing TEE event log with component measurements
   * @param reportedRtmr3 - RTMR3 value reported by TEE hardware for comparison
   * @returns Promise that resolves if integrity validation passes
   * @throws {Error} When event log JSON is malformed or contains invalid RTMR3 events
   * @throws {Error} When replayed RTMR3 doesn't match reported value (indicates tampering)
   * @throws {Error} When application ID doesn't match expected authorized application
   * @throws {Error} When required application events are missing from the log
   */
  public async verifyTEEApplicationIntegrity(
    eventLogJson: string,
    reportedRtmr3: string
  ): Promise<void> {
    const eventLog = this.parseEventLog(eventLogJson);
    await this.validateAllEvents(eventLog);
    const appInfo = this.extractApplicationInfo(eventLog);
    const replayedRtmr3 = await this.replayRtmr3(eventLog);

    if (replayedRtmr3 !== reportedRtmr3) {
      throw new Error(`RTMR3 mismatch: replayed ${replayedRtmr3} != reported ${reportedRtmr3}`);
    }

    this.validateApplicationInfo(appInfo);
  }

  /**
   * Verifies that the TEE attestation report cryptographically commits to the provided public key.
   *
   * This method establishes the critical link between the TEE hardware attestation and the
   * TEE's public key, which if left unchecked, may otherwise be modified by the system Relay.
   * It does so by:
   * 1. Extracting the report_data field from the TEE attestation
   * 2. Reconstructing the expected report_data by hashing 'app-data:' prefix + relay reported public key
   * 3. Comparing the reconstructed hash with the TEE-reported hash byte-by-byte
   *
   * The TEE report_data field contains a SHA-512 hash that was generated inside the TEE,
   * proving that the TEE had access to the public key during attestation generation.
   * This prevents key substitution attacks where a malicious Relay might try to use a different
   * public key than the one actually protected by the TEE.
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

  private extractTD(validatedReport: z.infer<typeof AttestationReportSchema>) {
    const td = validatedReport.report.TD10 ?? validatedReport.report.TD15;
    if (td == null) {
      throw new Error('No TD10 or TD15 report found in the quote');
    }

    return td;
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

  private parseEventLog(eventLogJson: string): EventLogEntry[] {
    try {
      const parsedLog = JSON.parse(eventLogJson);
      return EventLogSchema.parse(parsedLog);
    } catch (error) {
      throw new Error(`Failed to parse event log JSON: ${error}`);
    }
  }

  /**
   * Validates all events in the event log by verifying their digest values.
   *
   * Following the Phala team's reference implementation, only RTMR3 events are validated
   * as other IMR registers may have different validation requirements.
   *
   * @param eventLog - Array of event log entries to validate
   * @throws {Error} When any RTMR3 event has an invalid digest
   */
  private async validateAllEvents(eventLog: EventLogEntry[]): Promise<void> {
    for (const event of eventLog) {
      const isValid = await this.validateEvent(event);
      if (!isValid) {
        throw new Error(`Invalid event digest found for event: ${event.event} in IMR ${event.imr}`);
      }
    }
  }

  /**
   * Validates an individual event's digest according to the DStack format.
   *
   * Implementation based on the Phala team's reference code:
   * https://github.com/Dstack-TEE/dstack-examples/blob/main/attestation/rtmr3-based/verify.py
   *
   * Only validates IMR3 events - other events are skipped as they may have different
   * validation requirements. For RTMR3 events, calculates:
   * sha384(event_type:event_name:event_payload) and compares to stored digest.
   *
   * @param event - Event log entry to validate
   * @returns Promise resolving to true if the event is valid, false otherwise
   */
  private async validateEvent(event: EventLogEntry): Promise<boolean> {
    try {
      // Skip validation for non-IMR3 events, following Phala team's reference implementation
      if (event.imr !== RTMR3_IMR_INDEX) {
        return true;
      }

      // Validate event name is not empty and contains only valid characters
      if (!event.event || event.event.trim().length === 0) {
        return false;
      }

      // Convert event payload from hex to bytes for validation
      let eventPayloadBytes: Uint8Array;
      try {
        eventPayloadBytes = decodeBytes(event.event_payload, 'hex');
      } catch {
        // If hex decoding fails, treat as UTF-8 string (for empty payloads or plain text events)
        eventPayloadBytes = new TextEncoder().encode(event.event_payload);
      }

      // Build the validation string: event_type:event_name:event_payload
      // Event type is encoded as 4-byte little-endian integer (matching DStack reference implementation)
      const eventTypeBytes = new Uint8Array(4);
      eventTypeBytes[0] = event.event_type & 0xff; // LSB (least significant byte)
      eventTypeBytes[1] = (event.event_type >> 8) & 0xff;
      eventTypeBytes[2] = (event.event_type >> 16) & 0xff;
      eventTypeBytes[3] = (event.event_type >> 24) & 0xff; // MSB (most significant byte)

      const colonBytes = new TextEncoder().encode(':');
      const eventNameBytes = new TextEncoder().encode(event.event);

      const totalLength =
        eventTypeBytes.length +
        colonBytes.length +
        eventNameBytes.length +
        colonBytes.length +
        eventPayloadBytes.length;

      const buffer = new Uint8Array(totalLength);

      let offset = 0;
      buffer.set(eventTypeBytes, offset);
      offset += eventTypeBytes.length;
      buffer.set(colonBytes, offset);
      offset += colonBytes.length;
      buffer.set(eventNameBytes, offset);
      offset += eventNameBytes.length;
      buffer.set(colonBytes, offset);
      offset += colonBytes.length;
      buffer.set(eventPayloadBytes, offset);

      const calculatedHash = await crypto.subtle.digest(RTMR3_HASH_ALGORITHM, buffer);
      const calculatedDigest = encodeBytes(new Uint8Array(calculatedHash), 'hex');

      return calculatedDigest === event.digest;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extracts application information from validated event log entries.
   *
   * Looks for specific events (app-id, compose-hash, instance-id, key-provider)
   * and extracts their payload values for application validation.
   *
   * @param eventLog - Array of validated event log entries
   * @returns Object containing extracted application information
   * @throws {Error} When required application events are missing
   */
  private extractApplicationInfo(eventLog: EventLogEntry[]): ApplicationInfo {
    const appInfo: Partial<ApplicationInfo> = {};

    for (const event of eventLog) {
      switch (event.event) {
        case EVENT_NAMES.APP_ID:
          appInfo.app_id = event.event_payload;
          break;
        case EVENT_NAMES.COMPOSE_HASH:
          appInfo.compose_hash = event.event_payload;
          break;
        case EVENT_NAMES.INSTANCE_ID:
          appInfo.instance_id = event.event_payload;
          break;
        case EVENT_NAMES.KEY_PROVIDER:
          try {
            // Key provider might be stored as hex-encoded string
            const keyProviderBytes = decodeBytes(event.event_payload, 'hex');
            const keyProviderJson = new TextDecoder().decode(keyProviderBytes);
            appInfo.key_provider = JSON.parse(keyProviderJson);
          } catch {
            // If not hex, treat as regular string and parse JSON
            try {
              appInfo.key_provider = JSON.parse(event.event_payload);
            } catch {
              throw new Error(`Invalid key_provider JSON format: ${event.event_payload}`);
            }
          }

          try {
            appInfo.key_provider = KeyProviderSchema.parse(appInfo.key_provider);
          } catch (schemaError) {
            if (schemaError instanceof z.ZodError) {
              throw new Error(
                `Invalid key_provider: ${schemaError.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`
              );
            }
            throw schemaError;
          }
          break;
      }
    }

    try {
      return ApplicationInfoSchema.parse(appInfo);
    } catch (error) {
      throw new Error(`Missing required application events in log: ${error}`);
    }
  }

  /**
   * Validates that the extracted application information matches expected values.
   *
   * @param appInfo - Application information extracted from event log
   * @throws {Error} When application ID doesn't match expected value
   */
  private validateApplicationInfo(appInfo: ApplicationInfo): void {
    if (appInfo.app_id.toLowerCase() !== this.expectedAppId.toLowerCase()) {
      throw new Error(`Invalid app ID: expected ${this.expectedAppId}, got ${appInfo.app_id}`);
    }
  }

  /**
   * Replays RTMR3 calculation from validated event log entries.
   *
   * Filters events for IMR index 3 and replays the RTMR calculation using
   * the validated digest values directly, following the DStack approach.
   *
   * @param eventLog - Array of validated event log entries
   * @returns Promise resolving to the calculated RTMR3 value as a hexadecimal string
   */
  private async replayRtmr3(eventLog: EventLogEntry[]): Promise<string> {
    const rtmr3Events = eventLog.filter(event => event.imr === RTMR3_IMR_INDEX);
    const digestHistory = rtmr3Events.map(event => event.digest);

    return await this.replayRtmrHistory(digestHistory);
  }

  /**
   * Replay the RTMR history to calculate the final RTMR value.
   *
   * Implementation based on the Phala team's reference code:
   * https://github.com/Dstack-TEE/dstack-examples/blob/main/attestation/rtmr3-based/verify.py
   *
   * Uses SHA-384 to iteratively hash the measurement register with each digest:
   * mr = sha384(mr + digest) for each digest in history
   *
   * @param history - List of digest values to replay
   * @returns Promise resolving to the calculated RTMR value as a hexadecimal string
   */
  private async replayRtmrHistory(history: string[]): Promise<string> {
    if (history.length === 0) {
      return INIT_MR;
    }

    let mr = decodeBytes(INIT_MR, 'hex');

    for (const digest of history) {
      let digestBytes = decodeBytes(digest, 'hex');

      // Pad digest to 48 bytes (SHA-384 length) if shorter
      if (digestBytes.length < SHA384_HASH_LENGTH) {
        const paddedBytes = new Uint8Array(SHA384_HASH_LENGTH);
        paddedBytes.set(digestBytes, 0);
        digestBytes = paddedBytes;
      }

      // Calculate mr = sha384(mr + digest)
      const combined = new Uint8Array(mr.length + digestBytes.length);
      combined.set(mr, 0);
      combined.set(digestBytes, mr.length);

      const hashBuffer = await crypto.subtle.digest(RTMR3_HASH_ALGORITHM, combined);
      mr = new Uint8Array(hashBuffer);
    }

    return encodeBytes(mr, 'hex');
  }
}
