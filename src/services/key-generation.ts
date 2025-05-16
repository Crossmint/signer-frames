import type { Ed25519Service } from './ed25519';
import type { Secp256k1Service } from './secp256k1';
import { XMIFService } from './service';
export type ChainLayer = 'solana' | 'evm';

export class KeyGenerationService extends XMIFService {
  name = 'Key Generation Service';
  log_prefix = '[KeyGenerationService]';
  constructor(
    private readonly ed25519Service: Ed25519Service,
    private readonly secp256k1Service: Secp256k1Service
  ) {
    super();
  }

  async getPrivateKeyFromSeed(chainLayer: ChainLayer, seed: Uint8Array) {
    switch (chainLayer) {
      case 'solana':
        return this.ed25519Service.secretKeyFromSeed(seed);
      case 'evm':
        return this.secp256k1Service.privateKeyFromSeed(seed);
      default:
        throw new Error(`Unsupported chain layer: ${chainLayer}`);
    }
  }

  async getAddressFromSeed(chainLayer: ChainLayer, seed: Uint8Array) {
    switch (chainLayer) {
      case 'solana': {
        const secretKey = await this.ed25519Service.secretKeyFromSeed(seed);
        return this.ed25519Service.getPublicKey(secretKey);
      }
      case 'evm': {
        const privateKey = await this.secp256k1Service.privateKeyFromSeed(seed);
        const publicKey = await this.secp256k1Service.getPublicKey(privateKey);
        return this.secp256k1Service.getAddress(publicKey);
      }
      default:
        throw new Error(`Unsupported chain layer: ${chainLayer}`);
    }
  }
}
