import { DhkemP256HkdfSha256 } from '@hpke/core';
import { CrossmintFrameService } from '../service';
import { decodeBytes } from '../common/utils';
import type { AttestationService } from '../tee/attestation';

export class TEEKeyService extends CrossmintFrameService {
  name = 'TEE Key Service';
  log_prefix = '[TEEKeyService]';

  constructor(
    private attestationService?: AttestationService,
    private readonly kem = new DhkemP256HkdfSha256()
  ) {
    super();
  }
  async init() {
    if (!this.attestationService) {
      throw new Error('Attestation service not set');
    }
  }

  async getPublicKey(): Promise<CryptoKey> {
    if (!this.attestationService) {
      throw new Error('Attestation service not set');
    }
    const attestationPublicKey = await this.attestationService.getAttestedPublicKey();
    const recipientPublicKeyBuffer = decodeBytes(attestationPublicKey, 'base64').buffer;
    return await this.kem.deserializePublicKey(recipientPublicKeyBuffer);
  }

  setAttestationService(attestationService: AttestationService) {
    this.attestationService = attestationService;
  }
}
