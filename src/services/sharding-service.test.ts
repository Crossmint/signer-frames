import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ShardingService, ChainLayer, KeyShard } from './sharding-service';
import { ShardingService as ActualShardingService } from './sharding-service';
import type { StorageService, Stores } from './storage';
import { Stores as ActualStores } from './storage';
import type { CrossmintApiService } from './api';
import type { Ed25519Service } from './ed25519';
import { mock, mockReset, mockDeep } from 'vitest-mock-extended';
import { combine, split } from 'shamir-secret-sharing';
import * as ed from '@noble/ed25519';

// Unmock the shamir-secret-sharing library to use real functionality
vi.unmock('shamir-secret-sharing');

describe('ShardingService', () => {
  // Create mocks for dependencies
  const mockStorageService = mockDeep<StorageService>();
  const mockCrossmintApiService = mockDeep<CrossmintApiService>();
  const mockEd25519Service = mockDeep<Ed25519Service>();

  let shardingService: ActualShardingService;

  // Test data for chain layer
  const testDeviceId = 'test-device-id';
  const testChainLayer: ChainLayer = 'solana';

  // Create a real ed25519 keypair for testing
  const testPrivateKey = ed.utils.randomPrivateKey();
  let testPublicKey: string;
  let testShard1: Uint8Array;
  let testShard2: Uint8Array;

  const testKeyShard: KeyShard = {
    deviceId: testDeviceId,
    data: 'test-shard-data',
  };

  beforeEach(async () => {
    // Reset all mocks
    mockReset(mockStorageService);
    mockReset(mockCrossmintApiService);
    mockReset(mockEd25519Service);
    vi.resetAllMocks();

    // Configure mocks
    mockStorageService.initDatabase.mockResolvedValue({} as IDBDatabase);

    // Generate public key from test private key
    const publicKeyBytes = await ed.getPublicKey(testPrivateKey);
    testPublicKey = Buffer.from(publicKeyBytes).toString('base64');

    // Split the private key into two shares with a threshold of 2
    const shares = await split(testPrivateKey, 2, 2);
    testShard1 = shares[0];
    testShard2 = shares[1];

    // Create service with mocked dependencies
    shardingService = new ActualShardingService(
      mockStorageService,
      mockCrossmintApiService,
      mockEd25519Service
    );

    // Mock the ed25519Service getPublicKey to return our test public key
    mockEd25519Service.getPublicKey.mockResolvedValue(testPublicKey);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('init', () => {
    it('should initialize the storage service', async () => {
      await shardingService.init();
      expect(mockStorageService.initDatabase).toHaveBeenCalled();
    });
  });

  describe('recombineShards', () => {
    it('should recombine real key shards and derive public key', async () => {
      // Use real shards with real combine function
      const result = await shardingService.recombineShards(testShard1, testShard2, testChainLayer);

      // Verify the reconstructed private key matches the original
      const combinedPrivateKey = await combine([testShard1, testShard2]);
      expect(Buffer.from(combinedPrivateKey).toString('hex')).toEqual(
        Buffer.from(testPrivateKey).toString('hex')
      );

      expect(mockEd25519Service.getPublicKey).toHaveBeenCalledWith(combinedPrivateKey);
      expect(result).toEqual({
        privateKey: combinedPrivateKey,
        publicKey: testPublicKey,
      });
    });
  });

  describe('reconstructKey', () => {
    it('should retrieve device shard from local storage and recombine shards', async () => {
      const deviceShard: KeyShard = {
        deviceId: testDeviceId,
        data: Buffer.from(testShard1).toString('base64'),
      };

      const authShard: KeyShard = {
        deviceId: testDeviceId,
        data: Buffer.from(testShard2).toString('base64'),
      };

      vi.spyOn(shardingService, 'getDeviceKeyShardFromLocal').mockResolvedValue(deviceShard);

      const result = await shardingService.reconstructKey(authShard, testChainLayer);

      expect(shardingService.getDeviceKeyShardFromLocal).toHaveBeenCalledWith(testDeviceId);
      expect(mockEd25519Service.getPublicKey).toHaveBeenCalled();

      expect(result.publicKey).toEqual(testPublicKey);
    });

    it('should throw an error if device shard is not found', async () => {
      // Mock storage service to return null (no device shard found)
      vi.spyOn(shardingService, 'getDeviceKeyShardFromLocal').mockResolvedValue(null);

      await expect(shardingService.reconstructKey(testKeyShard, testChainLayer)).rejects.toThrow(
        `Device shard not found in IndexedDB for deviceId: ${testDeviceId}`
      );
    });
  });

  describe('storage methods', () => {
    it('should store device key shard locally', async () => {
      await shardingService.storeDeviceKeyShardLocally(testKeyShard);

      expect(mockStorageService.storeItem).toHaveBeenCalledWith(
        ActualStores.DEVICE_SHARES,
        {
          id: testKeyShard.deviceId,
          data: testKeyShard.data,
          type: 'base64KeyShard',
          created: expect.any(Number),
        },
        undefined
      );
    });

    it('should store auth key shard locally', async () => {
      await shardingService.storeAuthKeyShardLocally(testKeyShard);

      expect(mockStorageService.storeItem).toHaveBeenCalledWith(
        ActualStores.DEVICE_SHARES,
        {
          id: testKeyShard.deviceId,
          data: testKeyShard.data,
          type: 'base64KeyShard',
          created: expect.any(Number),
        },
        expect.any(Number)
      );
    });

    it('should retrieve device key shard from local storage', async () => {
      const storedItem = {
        id: testDeviceId,
        data: 'stored-shard-data',
        type: 'base64KeyShard',
        created: Date.now(),
        shard: true,
      };
      mockStorageService.getItem.mockResolvedValue(storedItem);

      const result = await shardingService.getDeviceKeyShardFromLocal(testDeviceId);

      expect(mockStorageService.getItem).toHaveBeenCalledWith(
        ActualStores.DEVICE_SHARES,
        testDeviceId
      );
      expect(result).toEqual({
        deviceId: testDeviceId,
        data: 'stored-shard-data',
      });
    });

    it('should return null if device key shard is not found', async () => {
      mockStorageService.getItem.mockResolvedValue(null);

      const result = await shardingService.getDeviceKeyShardFromLocal(testDeviceId);

      expect(result).toBeNull();
    });

    it('should retrieve auth key shard from local storage', async () => {
      const storedItem = {
        id: testDeviceId,
        data: 'stored-auth-shard',
        type: 'base64KeyShard',
        created: Date.now(),
        shard: true,
      };
      mockStorageService.getItem.mockResolvedValue(storedItem);

      const result = await shardingService.tryGetAuthKeyShardFromLocal(testDeviceId);

      expect(mockStorageService.getItem).toHaveBeenCalledWith(
        ActualStores.AUTH_SHARES,
        testDeviceId
      );
      expect(result).toEqual({
        deviceId: testDeviceId,
        data: 'stored-auth-shard',
      });
    });
  });

  describe('computePublicKey', () => {
    // We need to test the private method, so we'll use a workaround
    const callComputePublicKey = async (pk: Uint8Array, chain: ChainLayer): Promise<string> => {
      return (
        shardingService as unknown as {
          computePublicKey(privateKey: Uint8Array, chainLayer: ChainLayer): Promise<string>;
        }
      ).computePublicKey(pk, chain);
    };

    it('should compute a Solana public key correctly', async () => {
      const validPrivateKey = new Uint8Array(32).fill(1);
      mockEd25519Service.getPublicKey.mockResolvedValue(testPublicKey);

      const result = await callComputePublicKey(validPrivateKey, 'solana');

      expect(mockEd25519Service.getPublicKey).toHaveBeenCalledWith(validPrivateKey);
      expect(result).toBe(testPublicKey);
    });

    it('should throw error for invalid private key length', async () => {
      const invalidPrivateKey = new Uint8Array(16).fill(1); // Not 32 bytes

      await expect(callComputePublicKey(invalidPrivateKey, 'solana')).rejects.toThrow(
        'Invalid private key length: 16. Expected 32 bytes.'
      );
    });

    it('should throw error for unsupported chain layer', async () => {
      const validPrivateKey = new Uint8Array(32).fill(1);

      await expect(callComputePublicKey(validPrivateKey, 'evm' as ChainLayer)).rejects.toThrow(
        'EVM key derivation not yet implemented'
      );

      // @ts-expect-error - Testing with invalid chain type
      await expect(callComputePublicKey(validPrivateKey, 'invalid-chain')).rejects.toThrow(
        'Unsupported chain layer: invalid-chain'
      );
    });
  });
});
