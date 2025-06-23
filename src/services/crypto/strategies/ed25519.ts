import type { CryptoStrategy } from '../crypto-key-strategy';
import type { Ed25519Service } from '../algorithms/ed25519';
import bs58 from 'bs58';
import type { Encoding } from '@crossmint/client-signers';

export class Ed25519Strategy implements CryptoStrategy {
  readonly keyType = 'ed25519' as const;

  constructor(private readonly ed25519Service: Ed25519Service) {}

  async getPrivateKeyFromSeed(seed: Uint8Array): Promise<Uint8Array> {
    const fullSecretKey = await this.ed25519Service.secretKeyFromSeed(seed);
    return fullSecretKey.slice(0, 32);
  }

  async getPublicKey(privateKey: Uint8Array): Promise<Uint8Array> {
    const publicKeyBase58 = await this.ed25519Service.getPublicKey(privateKey);
    return bs58.decode(publicKeyBase58);
  }

  sign(privateKey: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    return this.ed25519Service.sign(message, privateKey);
  }

  formatPublicKey(publicKey: Uint8Array): { bytes: string; encoding: Encoding } {
    return { bytes: bs58.encode(publicKey), encoding: 'base58' };
  }

  formatSignature(signature: Uint8Array): { bytes: string; encoding: Encoding } {
    return { bytes: bs58.encode(signature), encoding: 'base58' };
  }
}
