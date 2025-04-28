import type { XMIFService } from './service';
import type { EncryptionData } from './encryption';

type SuccessfullyValidatedAttestationDocument = {
  validated: true;
} & EncryptionData;
type FailedToValidateAttestationDocument = {
  validated: false;
  error: string;
};

export type ValidateAttestationDocumentResult =
  | FailedToValidateAttestationDocument
  | SuccessfullyValidatedAttestationDocument;

export class AttestationService implements XMIFService {
  name = 'Attestation Service';
  async init() {}

  async validateAttestationDocument(): Promise<ValidateAttestationDocumentResult> {
    return {
      validated: true,
      publicKey: 'mock-public-key', // TODO: implement
      type: 'P384',
      encoding: 'base64',
    };
  }
}
