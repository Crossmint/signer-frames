import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateSignerEventHandler,
  SendOtpEventHandler,
  GetPublicKeyEventHandler,
  SignMessageEventHandler,
  SignTransactionEventHandler,
} from './handlers';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { CrossmintApiService } from './api';
import type { ShardingService } from './sharding-service';
import type { SignerInputEvent } from '@crossmint/client-signers';
import type { Ed25519Service } from './ed25519';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { base58Decode, base58Encode } from '../utils';

// Mock base64Decode
vi.mock('../utils', () => ({
  base64Decode: vi.fn().mockImplementation((str: string) => {
    return new Uint8Array([1, 2, 3, 4]);
  }),
}));

// Define common test data
const testDeviceId = 'test-device-id';
const testAuthData = {
  jwt: 'test-jwt',
  apiKey: 'test-api-key',
};
const testPublicKey = 'test-public-key';
const testPrivateKey = new Uint8Array(32).fill(1);

describe('EventHandlers', () => {
  // Mock dependencies
  const mockCrossmintApiService = mockDeep<CrossmintApiService>();
  const mockShardingService = mockDeep<ShardingService>();

  // Reset mocks before each test
  beforeEach(() => {
    mockReset(mockCrossmintApiService);
    mockReset(mockShardingService);
    vi.clearAllMocks();

    // Mock console.log to avoid clutter in test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('BaseEventHandler', () => {
    it('should measure function execution time in callback', async () => {
      const handler = new CreateSignerEventHandler(mockCrossmintApiService);
      const testInput: SignerInputEvent<'create-signer'> = {
        deviceId: testDeviceId,
        authData: testAuthData,
        data: { authId: 'test-auth-id' },
      };

      mockCrossmintApiService.createSigner.mockResolvedValue({} as Response);
      const spy = vi.spyOn(handler, 'handler');

      await handler.callback(testInput);

      expect(spy).toHaveBeenCalledWith(testInput);
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('CreateSignerEventHandler', () => {
    it('should have correct event names', () => {
      const handler = new CreateSignerEventHandler(mockCrossmintApiService);
      expect(handler.event).toBe('request:create-signer');
      expect(handler.responseEvent).toBe('response:create-signer');
    });

    it('should call createSigner with correct parameters', async () => {
      const handler = new CreateSignerEventHandler(mockCrossmintApiService);
      const testInput: SignerInputEvent<'create-signer'> = {
        deviceId: testDeviceId,
        authData: testAuthData,
        data: { authId: 'test-auth-id' },
      };

      mockCrossmintApiService.createSigner.mockResolvedValue({} as Response);

      const result = await handler.handler(testInput);

      expect(mockCrossmintApiService.createSigner).toHaveBeenCalledWith(
        testDeviceId,
        testAuthData,
        { authId: 'test-auth-id' }
      );
      expect(result).toEqual({});
    });
  });

  describe('SendOtpEventHandler', () => {
    it('should have correct event names', () => {
      const handler = new SendOtpEventHandler(mockCrossmintApiService, mockShardingService);
      expect(handler.event).toBe('request:send-otp');
      expect(handler.responseEvent).toBe('response:send-otp');
    });

    it('should process OTP and store key shards', async () => {
      const handler = new SendOtpEventHandler(mockCrossmintApiService, mockShardingService);
      const testInput: SignerInputEvent<'send-otp'> = {
        deviceId: testDeviceId,
        authData: testAuthData,
        data: {
          encryptedOtp: '123456',
          chainLayer: 'solana',
        },
      };

      const mockedResponse = {
        shares: {
          device: 'device-share-base64',
          auth: 'auth-share-base64',
        },
      };

      mockCrossmintApiService.sendOtp.mockResolvedValue(mockedResponse);
      mockShardingService.recombineShards.mockResolvedValue({
        privateKey: testPrivateKey,
        publicKey: testPublicKey,
      });

      const result = await handler.handler(testInput);

      expect(mockCrossmintApiService.sendOtp).toHaveBeenCalledWith(testDeviceId, testAuthData, {
        otp: '123456',
      });

      expect(mockShardingService.storeDeviceKeyShardLocally).toHaveBeenCalledWith({
        deviceId: testDeviceId,
        data: 'device-share-base64',
      });

      expect(mockShardingService.storeAuthKeyShardLocally).toHaveBeenCalledWith({
        deviceId: testDeviceId,
        data: 'auth-share-base64',
      });

      expect(mockShardingService.recombineShards).toHaveBeenCalled();
      expect(result).toEqual({ address: testPublicKey });
    });
  });

  describe('GetPublicKeyEventHandler', () => {
    it('should have correct event names', () => {
      const handler = new GetPublicKeyEventHandler(mockShardingService);
      expect(handler.event).toBe('request:get-public-key');
      expect(handler.responseEvent).toBe('response:get-public-key');
    });

    it('should retrieve and reconstruct the key', async () => {
      const handler = new GetPublicKeyEventHandler(mockShardingService);
      const testInput: SignerInputEvent<'get-public-key'> = {
        deviceId: testDeviceId,
        authData: testAuthData,
        data: {
          chainLayer: 'solana',
        },
      };

      mockCrossmintApiService.getAuthShard.mockResolvedValue({
        deviceId: testDeviceId,
        keyShare: 'auth-key-share',
      });

      mockShardingService.reconstructKey.mockResolvedValue({
        privateKey: testPrivateKey,
        publicKey: testPublicKey,
      });

      const result = await handler.handler(testInput);

      expect(mockCrossmintApiService.getAuthShard).toHaveBeenCalledWith(testDeviceId, testAuthData);

      expect(mockShardingService.reconstructKey).toHaveBeenCalledWith(
        {
          deviceId: testDeviceId,
          data: 'auth-key-share',
        },
        'solana'
      );

      expect(result).toEqual({ publicKey: testPublicKey });
    });
  });

  describe('SignMessageEventHandler', () => {
    const mockEd25519Service = mockDeep<Ed25519Service>();

    beforeEach(() => {
      mockReset(mockEd25519Service);
    });

    it('should have correct event names', () => {
      const handler = new SignMessageEventHandler(mockShardingService, mockEd25519Service);
      expect(handler.event).toBe('request:sign-message');
      expect(handler.responseEvent).toBe('response:sign-message');
    });

    it('should throw "Not implemented" error for unsupported chain layers', async () => {
      const handler = new SignMessageEventHandler(mockShardingService, mockEd25519Service);
      const testInput: SignerInputEvent<'sign-message'> = {
        deviceId: testDeviceId,
        authData: testAuthData,
        data: {
          chainLayer: 'evm', // Use EVM to trigger the 'not implemented' error
          message: 'test message', // Use a string message
          encoding: 'base58', // Add required encoding property
        },
      };

      // Mock the necessary methods to avoid other errors
      mockShardingService.tryGetAuthKeyShardFromLocal.mockResolvedValue({
        deviceId: testDeviceId,
        data: 'auth-key-share',
      });

      mockShardingService.reconstructKey.mockResolvedValue({
        privateKey: testPrivateKey,
        publicKey: testPublicKey,
      });

      await expect(handler.handler(testInput)).rejects.toThrow('Chain layer not implemented');
    });
  });

  describe('SignTransactionEventHandler', () => {
    const mockEd25519Service = mockDeep<Ed25519Service>();
    const mockShardingService = mockDeep<ShardingService>();
    const mockSigner = Keypair.generate();
    let serializedTransaction: string;

    beforeEach(() => {
      mockReset(mockEd25519Service);
      mockShardingService.reconstructKey.mockResolvedValue({
        privateKey: testPrivateKey,
        publicKey: testPublicKey,
      });

      const transaction = new VersionedTransaction(
        new TransactionMessage({
          recentBlockhash: '11111111111111111111111111111111',
          payerKey: mockSigner.publicKey,
          instructions: [
            SystemProgram.transfer({
              fromPubkey: mockSigner.publicKey,
              toPubkey: new PublicKey('22222222222222222222222222222222'),
              lamports: 1,
            }),
          ],
        }).compileToV0Message()
      );
      serializedTransaction = base58Encode(transaction.serialize());
    });

    it('should have correct event names', () => {
      const handler = new SignTransactionEventHandler(mockShardingService, mockEd25519Service);
      expect(handler.event).toBe('request:sign-transaction');
      expect(handler.responseEvent).toBe('response:sign-transaction');
    });

    it('should sign the transaction', async () => {
      const handler = new SignTransactionEventHandler(mockShardingService, mockEd25519Service);
      const testInput: SignerInputEvent<'sign-transaction'> = {
        deviceId: testDeviceId,
        authData: testAuthData,
        data: {
          transaction: serializedTransaction,
          chainLayer: 'solana',
          encoding: 'base58',
        },
      };

      const result = await handler.handler(testInput);
      const signedTransaction = VersionedTransaction.deserialize(
        base58Decode(serializedTransaction)
      );
      signedTransaction.sign([mockSigner]);

      expect(result).toEqual({
        publicKey: testPublicKey,
        transaction: base58Encode(signedTransaction.serialize()),
        signature: base58Encode(signedTransaction.signatures[0]),
      });
    });
  });
});
