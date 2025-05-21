import { toHex } from 'ethereum-cryptography/utils';
import type { Ed25519Service } from './ed25519';
import type { Secp256k1Service } from './secp256k1';
import { XMIFService } from './service';
export type KeyType = 'ed25519' | 'secp256k1';
export class KeyGenerationService extends XMIFService {
  name = 'Key Generation Service';
  log_prefix = '[KeyGenerationService]';
  constructor(
    private readonly ed25519Service: Ed25519Service,
    private readonly secp256k1Service: Secp256k1Service
  ) {
    super();
  }

  async getPrivateKeyFromSeed(keyType: KeyType, seed: Uint8Array) {
    switch (keyType) {
      case 'ed25519':
        return this.ed25519Service.secretKeyFromSeed(seed);
      case 'secp256k1':
        return this.secp256k1Service.privateKeyFromSeed(seed);
      default:
        throw new Error(`Unsupported key type: ${keyType}`);
    }
  }

  async getPublicKeyFromSeed(keyType: KeyType, seed: Uint8Array) {
    switch (keyType) {
      case 'ed25519': {
        const secretKey = await this.ed25519Service.secretKeyFromSeed(seed);
        return {
          bytes: await this.ed25519Service.getPublicKey(secretKey),
          encoding: 'base58' as const,
          keyType,
        };
      }
      case 'secp256k1': {
        const privateKey = await this.secp256k1Service.privateKeyFromSeed(seed);
        // TODO: change to hex
        return {
          bytes: Buffer.from(await this.secp256k1Service.getPublicKey(privateKey)).toString(
            'base64'
          ),
          encoding: 'base64' as const,
          keyType,
        };
      }
      default:
        throw new Error(`Unsupported key type: ${keyType}`);
    }
  }
}
