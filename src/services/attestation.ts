import type { CrossmintApiService } from './api';
import { XMIFService } from './service';
import init, { js_get_collateral, js_verify } from '@phala/dcap-qvl-web';
import wasm from '@phala/dcap-qvl-web/dcap-qvl-web_bg.wasm';
import { decodeBytes } from './utils';
import { isDevelopment } from './environment';

const PCCS_URL = 'https://pccs.phala.network/tdx/certification/v4';
const ATTESTATION_VERIFIED_STATUS = 'UpToDate';

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
    this.log('TEE attestation document fetched', JSON.stringify(attestation, null, 2));

    await init(wasm);

    const decodedQuote = decodeBytes(attestation.quote, 'hex');
    const collateral = await js_get_collateral(PCCS_URL, decodedQuote);

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const { status } = await js_verify(decodedQuote, collateral, currentTime);

    if (status !== ATTESTATION_VERIFIED_STATUS) {
      throw new Error('TEE Attestation is invalid');
    }

    this.log('TEE attestation document validated! Continuing...');
    return attestation.publicKey; // TODO parse key from attestation "report_data".
  }

  async getPublicKeyDevMode(): Promise<string> {
    const response = await this.api.getPublicKey();
    return response.publicKey;
  }
}
