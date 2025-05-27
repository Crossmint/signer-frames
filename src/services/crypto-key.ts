import { toHex } from 'ethereum-cryptography/utils';
import type { Ed25519Service } from './ed25519';
import type { Secp256k1Service } from './secp256k1';
import { XMIFService } from './service';
import bs58 from 'bs58';
import type { Encoding, KeyType } from '@crossmint/client-signers';
const KEY_TYPES: KeyType[] = ['ed25519', 'secp256k1'];
export class PrivateKey extends Uint8Array {
  keyType: KeyType;
  constructor(bytes: Uint8Array, keyType: KeyType) {
    super(bytes);
    this.keyType = keyType;
  }

  toDefaultFormat() {
    switch (this.keyType) {
      case 'ed25519':
        return bs58.encode(this);
      case 'secp256k1':
        return toHex(this);
    }
  }
}

export type KeyPair<T extends KeyType = KeyType> = {
  keyType: T;
  privateKey: PrivateKey;
  publicKey: {
    bytes: string;
    encoding: Encoding;
    keyType: T;
  };
};

export class CryptoKeyService extends XMIFService {
  name = 'Crypto Key Service';
  log_prefix = '[CryptoKeyService]';
  constructor(
    private readonly ed25519Service: Ed25519Service,
    private readonly secp256k1Service: Secp256k1Service
  ) {
    super();
  }

  async getAllPublicKeysFromSeed(seed: Uint8Array): Promise<
    Record<
      KeyType,
      {
        bytes: string;
        encoding: Encoding;
      }
    >
  > {
    return this.getPublicKeysFromSeed(seed, KEY_TYPES);
  }

  async getPublicKeysFromSeed<T extends KeyType>(
    seed: Uint8Array,
    keyTypes: T[]
  ): Promise<
    Record<
      T,
      {
        bytes: string;
        encoding: Encoding;
        keyType: T;
      }
    >
  > {
    const publicKeys: Partial<
      Record<
        T,
        {
          bytes: string;
          encoding: Encoding;
        }
      >
    > = {};
    for (const keyType of keyTypes) {
      const publicKey = await this.getPublicKeyFromSeed(keyType, seed);
      publicKeys[keyType] = publicKey;
    }
    return publicKeys as Record<
      T,
      {
        bytes: string;
        encoding: Encoding;
        keyType: T;
      }
    >;
  }

  async getKeyPairFromSeed<T extends KeyType>(keyType: T, seed: Uint8Array): Promise<KeyPair> {
    const privateKey = await this.getPrivateKeyFromSeed(keyType, seed);
    const publicKey = await this.getPublicKeyFromSeed(keyType, seed);
    return {
      keyType,
      privateKey,
      publicKey,
    };
  }

  async getPrivateKeyFromSeed(keyType: KeyType, seed: Uint8Array): Promise<PrivateKey> {
    switch (keyType) {
      case 'ed25519':
        return new PrivateKey(await this.ed25519Service.secretKeyFromSeed(seed), keyType);
      case 'secp256k1':
        return new PrivateKey(await this.secp256k1Service.privateKeyFromSeed(seed), keyType);
      default:
        throw new Error(`Unsupported key type: ${keyType}`);
    }
  }

  async getPublicKeyFromSeed<T extends KeyType>(keyType: T, seed: Uint8Array) {
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

  async sign(keyType: KeyType, privateKey: PrivateKey, message: Uint8Array) {
    switch (keyType) {
      case 'ed25519':
        return {
          bytes: bs58.encode(await this.ed25519Service.sign(message, privateKey)),
          encoding: 'base58' as const,
        };
      case 'secp256k1':
        return {
          bytes: await this.secp256k1Service.sign(message, privateKey),
          encoding: 'hex' as const,
        };
      default:
        throw new Error(`Unsupported key type: ${keyType}`);
    }
  }
}
