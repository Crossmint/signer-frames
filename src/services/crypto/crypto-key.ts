import { CrossmintFrameService } from '../service';
import type { Encoding, KeyType } from '@crossmint/client-signers';
import type { CryptoStrategy, PublicKey, Signature } from './crypto-key-strategy';

// Import the concrete strategy classes and the base services they depend on
import { Ed25519Service } from './algorithms/ed25519';
import { Secp256k1Service } from './algorithms/secp256k1';
import { Ed25519Strategy } from './strategies/ed25519';
import { Secp256k1Strategy } from './strategies/secp256k1';

export class CryptoKeyService extends CrossmintFrameService {
  name = 'Crypto Key Service';
  log_prefix = '[CryptoKeyService]';

  private strategies: Map<KeyType, CryptoStrategy<KeyType>>;

  constructor(ed25519Service: Ed25519Service, secp256k1Service: Secp256k1Service) {
    super();
    this.strategies = new Map();

    this.registerStrategy(new Ed25519Strategy(ed25519Service));
    this.registerStrategy(new Secp256k1Strategy(secp256k1Service));
  }

  private registerStrategy<K extends KeyType>(strategy: CryptoStrategy<K>): void {
    this.strategies.set(strategy.keyType, strategy);
  }

  private getStrategy<K extends KeyType>(keyType: K): CryptoStrategy<K> {
    const strategy = this.strategies.get(keyType);
    if (!strategy) {
      throw new Error(`Unsupported key type: ${keyType}`);
    }
    return strategy as CryptoStrategy<K>;
  }

  async getPrivateKeyFromSeed<K extends KeyType>(
    keyType: K,
    seed: Uint8Array
  ): Promise<Uint8Array> {
    const strategy = this.getStrategy(keyType);
    return strategy.getPrivateKeyFromSeed(seed);
  }

  async getPublicKeyFromSeed<K extends KeyType>(
    keyType: K,
    seed: Uint8Array
  ): Promise<PublicKey<K>> {
    const strategy = this.getStrategy(keyType);
    const privateKey = await strategy.getPrivateKeyFromSeed(seed);
    const publicKey = await strategy.getPublicKey(privateKey);
    return {
      ...strategy.formatPublicKey(publicKey),
      keyType,
    };
  }

  async getAllPublicKeysFromSeed(seed: Uint8Array): Promise<Record<KeyType, PublicKey<KeyType>>> {
    const publicKeys: Partial<Record<KeyType, PublicKey<KeyType>>> = {};
    for (const keyType of this.strategies.keys()) {
      publicKeys[keyType] = await this.getPublicKeyFromSeed(keyType, seed);
    }
    return publicKeys as Record<KeyType, PublicKey<KeyType>>;
  }

  async sign<K extends KeyType>(
    keyType: K,
    privateKey: Uint8Array,
    message: Uint8Array
  ): Promise<{ signature: Signature<K>; publicKey: PublicKey<K> }> {
    const strategy = this.getStrategy(keyType);
    const signature = await strategy.sign(privateKey, message);
    const publicKey = await strategy.getPublicKey(privateKey);
    return {
      signature: strategy.formatSignature(signature),
      publicKey: {
        ...strategy.formatPublicKey(publicKey),
        keyType,
      },
    };
  }
}
