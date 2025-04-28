import type { XMIFService } from './service';

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

export class AttestationService implements XMIFService {
  name = 'Attestation Service';
  // This being not null implicitly assumes validation
  private attestationDoc: AttestationDocument | null = null;

  async init() {
    try {
      const attestationDoc = await this.fetchAttestationDoc();
      const validationResult = await this.validateAttestationDoc(attestationDoc);
      if (!validationResult.validated) {
        throw new Error(`Error validating TEE Attestation: ${validationResult.error}`);
      }
      this.attestationDoc = attestationDoc;
    } catch (e: unknown) {
      console.log('Failed to validate attestation document! This error is not recoverable');
      this.attestationDoc = null;
      throw e;
    }
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
    return fetch('https://tee-ts.onrender.com/attestation').then(res => res.json()); // TODO: Shouldn't be hardcoded
  }

  private assertInitialized(): NonNullable<typeof this.attestationDoc> {
    if (!this.attestationDoc) {
      throw new Error('Attestation service has not been initialized!');
    }
    return this.attestationDoc;
  }
}
