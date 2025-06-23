import type { CryptoStrategy, PublicKey, Signature } from '../crypto-key-strategy';
import type { Secp256k1Service } from '../algorithms/secp256k1';
import type { Encoding } from '@crossmint/client-signers';
import { toHex, hexToBytes } from 'ethereum-cryptography/utils';

export class Secp256k1Strategy implements CryptoStrategy<'secp256k1'> {
  readonly keyType = 'secp256k1' as const;

  constructor(private readonly secp256k1Service: Secp256k1Service) {}

  getPrivateKeyFromSeed(seed: Uint8Array): Promise<Uint8Array> {
    return this.secp256k1Service.privateKeyFromSeed(seed);
  }

  getPublicKey(privateKey: Uint8Array): Promise<Uint8Array> {
    return this.secp256k1Service.getPublicKey(privateKey);
  }

  // This strategy expects a 32-byte digest, which it passes to the service.
  async sign(privateKey: Uint8Array, digest: Uint8Array): Promise<Uint8Array> {
    const hexSignature = await this.secp256k1Service.sign(digest, privateKey);
    return hexToBytes(hexSignature);
  }

  formatPublicKey(publicKey: Uint8Array): PublicKey<'secp256k1'> {
    return { bytes: `0x${toHex(publicKey)}`, encoding: 'hex', keyType: 'secp256k1' };
  }

  formatSignature(signature: Uint8Array): Signature<'secp256k1'> {
    return { bytes: `0x${toHex(signature)}`, encoding: 'hex', keyType: 'secp256k1' };
  }
}
