import { combine } from 'shamir-secret-sharing';
import { Ed25519Service } from './ed25519';
import { base64Decode } from '../utils';
import { CrossmintApiService } from './api';

// Supported chain layers
export type ChainLayer = 'solana' | 'evm';

// Key shard structure
export interface KeyShard {
  data: string;
}

export interface RecombinedKeys {
  privateKey: Uint8Array;
  publicKey: string;
}

const AUTH_SHARE_KEY = 'auth-share';
const DEVICE_SHARE_KEY = 'device-share';
const LOG_PREFIX = '[ShardingService]';

export class ShardingService {
  constructor(
    private readonly ed25519Service: Ed25519Service = new Ed25519Service(),
    private readonly api: CrossmintApiService = new CrossmintApiService()
  ) {
    console.log(`${LOG_PREFIX} Initializing ShardingService`);
  }

  public getDeviceId(): string {
    console.log(`${LOG_PREFIX} Attempting to get device ID from storage`);

    const existing = localStorage.getItem('deviceId');
    if (existing != null) {
      console.log(`${LOG_PREFIX} Found existing device ID: ${existing.substring(0, 8)}...`);
      return existing;
    }

    console.log(`${LOG_PREFIX} No existing device ID found, generating new one`);
    const deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
    console.log(`${LOG_PREFIX} Successfully stored new device ID: ${deviceId.substring(0, 8)}...`);
    return deviceId;
  }

  public async getLocalKeyInstance(
    authData: { jwt: string; apiKey: string },
    chainLayer: ChainLayer
  ) {
    console.log(`${LOG_PREFIX} Getting local key instance for chain: ${chainLayer}`);

    const deviceShare = this.getDeviceShare();
    if (!deviceShare) {
      throw new Error('Device share not found');
    }

    let authShare = this.getCachedAuthShare();
    if (!authShare) {
      console.log(`${LOG_PREFIX} Auth share not found in cache, fetching from API`);
      const deviceId = this.getDeviceId();
      const { keyShare } = await this.api.getAuthShard(deviceId, authData);
      this.cacheAuthShare(keyShare);
      authShare = keyShare;
    }

    console.log(`${LOG_PREFIX} Recombining key shards for ${chainLayer}`);
    const { privateKey, publicKey } = await this.recombineShards(
      base64Decode(deviceShare),
      base64Decode(authShare),
      chainLayer
    );

    return {
      privateKey,
      publicKey,
    };
  }

  storeDeviceShare(share: string): void {
    localStorage.setItem(DEVICE_SHARE_KEY, share);
  }

  cacheAuthShare(share: string): void {
    sessionStorage.setItem(AUTH_SHARE_KEY, share);
  }

  getDeviceShare(): string | null {
    return localStorage.getItem(DEVICE_SHARE_KEY);
  }

  getCachedAuthShare(): string | null {
    return sessionStorage.getItem(AUTH_SHARE_KEY);
  }

  /**
   * Recombines key shards to recover the private key and derive the public key
   * @param shard1 First key shard
   * @param shard2 Second key shard
   * @param chainLayer The blockchain layer (solana, evm, etc.)
   * @returns The recombined private key and public key
   */
  private async recombineShards(
    shard1: Uint8Array,
    shard2: Uint8Array,
    chainLayer: ChainLayer
  ): Promise<RecombinedKeys> {
    try {
      const privateKey = await combine([shard1, shard2]);
      const publicKey = await this.computePublicKey(privateKey, chainLayer);

      return {
        privateKey,
        publicKey,
      };
    } catch (error) {
      throw new Error(
        `Failed to recombine key shards: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Computes a public key from a private key for a specific chain
   * @param privateKey The private key as Uint8Array
   * @param chainLayer The blockchain layer (solana, evm, etc.)
   * @returns The formatted public key as a string
   */
  private async computePublicKey(privateKey: Uint8Array, chainLayer: ChainLayer): Promise<string> {
    if (privateKey.length !== 32) {
      const errorMsg = `Invalid private key length: ${privateKey.length}. Expected 32 bytes.`;
      throw new Error(errorMsg);
    }

    switch (chainLayer) {
      case 'solana': {
        return await this.ed25519Service.getPublicKey(privateKey);
      }
      case 'evm':
        throw new Error('EVM key derivation not yet implemented');
      default:
        throw new Error(`Unsupported chain layer: ${chainLayer}`);
    }
  }
}
