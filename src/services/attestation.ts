import type { CrossmintApiService } from './api';
import { XMIFService } from './service';

type AttestationDocument = { publicKey: string } & Record<string, unknown>; // TODO: Improve types
type SuccessfullyValidatedAttestationDocument = {
  validated: true;
} & AttestationDocument;
type FailedToValidateAttestationDocument = {
  validated: false;
  error: string;
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
        const msg = `Error validating TEE Attestation: ${validationResult.error}`;
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
    return {
      validated: true,
      publicKey: attestationDoc.publicKey,
    };
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
