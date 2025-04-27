type SuccessfullyValidatedAttestationDocument = {
  validated: true;
  publicKey: string;
};
type FailedToValidateAttestationDocument = {
  validated: false;
  error: string;
};

export type ValidateAttestationDocumentResult =
  | FailedToValidateAttestationDocument
  | SuccessfullyValidatedAttestationDocument;

export type EncryptionData = Pick<SuccessfullyValidatedAttestationDocument, 'publicKey'>;
export class AttestationService {
  async init() {}

  async validateAttestationDocument(): Promise<ValidateAttestationDocumentResult> {
    return {
      validated: true,
      publicKey: 'mock-public-key', // TODO: implement
    };
  }
}
