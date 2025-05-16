import type { Ed25519Service } from './ed25519';
import type { Secp256k1Service } from './secp256k1';

export class AddressGenerator {
  constructor(
    private readonly ed25519Service: Ed25519Service,
    private readonly secp256k1Service: Secp256k1Service
  ) {}

  async getAddressFromSeed(chainLayer: 'solana' | 'evm', seed: Uint8Array) {
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
