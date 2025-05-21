import { toHex } from 'ethereum-cryptography/utils';
import type { Ed25519Service } from './ed25519';
import type { Secp256k1Service } from './secp256k1';
import { XMIFService } from './service';
import bs58 from 'bs58';
export type KeyType = 'ed25519' | 'secp256k1';
export class CryptoKeyService extends XMIFService {
  name = 'Crypto Key Service';
  log_prefix = '[CryptoKeyService]';
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
        return {
          bytes: toHex(await this.secp256k1Service.getPublicKey(privateKey)),
          encoding: 'hex' as const,
          keyType,
        };
      }
      default:
        throw new Error(`Unsupported key type: ${keyType}`);
    }
  }

  async sign(keyType: KeyType, seed: Uint8Array, message: Uint8Array) {
    switch (keyType) {
      case 'ed25519':
        return {
          bytes: bs58.encode(await this.ed25519Service.sign(seed, message)),
          encoding: 'base58' as const,
        };
      case 'secp256k1':
        return {
          bytes: await this.secp256k1Service.sign(seed, message),
          encoding: 'hex' as const,
        };
      default:
        throw new Error(`Unsupported key type: ${keyType}`);
    }
  }
}
