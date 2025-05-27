import type { CrossmintApiService } from './api';
import { XMIFService } from './service';
import init, { js_get_collateral, js_verify } from '@phala/dcap-qvl-web';
import wasm from '@phala/dcap-qvl-web/dcap-qvl-web_bg.wasm';
import { decodeBytes } from './utils';

const PCCS_URL = 'https://pccs.phala.network/tdx/certification/v4';
type AttestationDocument = { publicKey: string; quote: string };
type SuccessfullyValidatedAttestationDocument = {
  validated: true;
  publicKey: string;
};
type FailedToValidateAttestationDocument = {
  validated: false;
};

export type ValidateAttestationDocumentResult =
  | FailedToValidateAttestationDocument
  | SuccessfullyValidatedAttestationDocument;

export class AttestationService extends XMIFService {
  name = 'Attestation Service';
  log_prefix = '[AttestationService]';

  constructor(private readonly api: CrossmintApiService) {
    super();
  }

  // This being not null implicitly assumes validation
  private attestationDoc: AttestationDocument | null = null;

  async init() {
    try {
      const attestationDoc = await this.fetchAttestationDoc();

      this.log('TEE attestation document fetched', JSON.stringify(attestationDoc, null, 2));
      const validationResult = await this.validateAttestationDoc(attestationDoc);
      if (!validationResult.validated) {
        const msg = 'Error validating TEE Attestation';
        this.logError(msg);
        throw new Error(msg);
      }

      this.log('TEE attestation document validated! Continuing...');
      this.attestationDoc = attestationDoc;
    } catch (e: unknown) {
      this.logError('Failed to validate attestation document! This error is not recoverable');
      this.attestationDoc = null;
      throw e;
    }
  }

  async getAttestationDocument(): Promise<AttestationDocument> {
    const doc = this.assertInitialized();
    return doc;
  }

  async getPublicKeyFromAttestation(): Promise<string> {
    const doc = this.assertInitialized();
    return doc.publicKey;
  }

  private async validateAttestationDoc(
    attestationDoc: AttestationDocument
  ): Promise<ValidateAttestationDocumentResult> {
    await init(wasm);

    const decodedQuote = decodeBytes(attestationDoc.quote, 'hex');
    const collateral = await js_get_collateral(PCCS_URL, decodedQuote);

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const { status } = await js_verify(decodedQuote, collateral, currentTime);

    if (status === 'UpToDate') {
      return {
        validated: true,
        publicKey: attestationDoc.publicKey,
      };
    }

    return { validated: false };
  }

  private async fetchAttestationDoc(): Promise<AttestationDocument> {
    return this.api.getAttestation();
  }

  private assertInitialized(): NonNullable<typeof this.attestationDoc> {
    if (!this.attestationDoc) {
      throw new Error('Attestation service has not been initialized!');
    }
    return this.attestationDoc;
  }
}
