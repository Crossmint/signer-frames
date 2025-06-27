import { DhkemP256HkdfSha256 } from '@hpke/core';
import { CrossmintFrameService } from '../service';
import type { AttestationService } from '../tee/attestation';
import { decodeBytes } from '../encryption/lib/primitives/encoding';

export class TEEKeyProvider extends CrossmintFrameService {
  name = 'TEE Key Provider';
  log_prefix = '[TEEKeyProvider]';

  constructor(private attestationService?: AttestationService) {
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
    return new PublicKeyDeserializer().deserialize(attestationPublicKey);
  }

  setAttestationService(attestationService: AttestationService) {
    this.attestationService = attestationService;
  }
}

export class PublicKeyDeserializer {
  constructor(private readonly kem = new DhkemP256HkdfSha256()) {}

  async deserialize(serializedPublicKey: string): Promise<CryptoKey> {
    const recipientPublicKeyBuffer = decodeBytes(serializedPublicKey, 'base64').buffer;
    return await this.kem.deserializePublicKey(recipientPublicKeyBuffer);
  }
}
