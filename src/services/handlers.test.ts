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
import type { SolanaService } from './SolanaService';
import type { Keypair } from '@solana/web3.js';
import type { AttestationService } from './attestation';

// Add missing type for getLocalKeyInstance
declare module './sharding-service' {
  interface ShardingService {
    getLocalKeyInstance(
      authData: { jwt: string; apiKey: string },
      chainLayer: string
    ): Promise<{ publicKey: string }>;
  }
}

// Mock dependencies first, before any variable references
vi.mock('../utils', () => ({
  base64Decode: vi.fn().mockImplementation(() => new Uint8Array([1, 2, 3, 4])),
  base58Encode: vi.fn().mockReturnValue('encoded-transaction'),
  base58Decode: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4])),
}));

// Mock @solana/web3.js without using any variables defined in this file
vi.mock('@solana/web3.js', async () => {
  const mockPublicKey = {
    equals: vi.fn().mockReturnValue(true),
    toBase58: vi.fn().mockReturnValue('mock-public-key'),
    toBytes: vi.fn().mockReturnValue(new Uint8Array(32)),
    toBuffer: vi.fn().mockReturnValue(Buffer.from(new Uint8Array(32))),
    toJSON: vi.fn().mockReturnValue('mock-public-key'),
    toString: vi.fn().mockReturnValue('mock-public-key'),
  };

  const mockKeypair = {
    publicKey: mockPublicKey,
    secretKey: new Uint8Array(64).fill(1),
    _keypair: { secretKey: new Uint8Array(64).fill(1) },
  };

  const mockTransaction = {
    message: {
      staticAccountKeys: [mockPublicKey],
    },
    sign: vi.fn(),
    serialize: vi.fn().mockReturnValue(new Uint8Array([5, 6, 7, 8])),
    signatures: ['test-signature'],
  };

  return {
    Keypair: {
      generate: vi.fn().mockReturnValue(mockKeypair),
      fromSecretKey: vi.fn().mockReturnValue(mockKeypair),
      fromSeed: vi.fn().mockReturnValue(mockKeypair),
    },
    PublicKey: vi.fn().mockImplementation(() => mockPublicKey),
    VersionedTransaction: {
      deserialize: vi.fn().mockReturnValue(mockTransaction),
    },
    SystemProgram: {
      transfer: vi.fn().mockReturnValue({}),
    },
    TransactionMessage: vi.fn().mockImplementation(() => ({
      compileToV0Message: vi.fn().mockReturnValue({}),
    })),
  };
});

// Define common test data
const testDeviceId = 'test-device-id';
const testAuthData = {
  jwt: 'test-jwt',
  apiKey: 'test-api-key',
};
const testPublicKey = 'test-public-key';
const testPrivateKey = new Uint8Array(32).fill(1);

// Define type for create-signer input data
type CreateSignerData = {
  authId: string;
  chainLayer: string;
};

describe('EventHandlers', () => {
  // Mock dependencies
  const mockCrossmintApiService = mockDeep<CrossmintApiService>();
  const mockShardingService = mockDeep<ShardingService>();
  const mockSolanaService = mockDeep<SolanaService>();
  const mockAttestationService = mockDeep<AttestationService>();

  // Reset mocks before each test
  beforeEach(() => {
    mockReset(mockCrossmintApiService);
    mockReset(mockShardingService);
    mockReset(mockSolanaService);
    mockReset(mockAttestationService);
    vi.clearAllMocks();

    // Mock Keypair return value
    const mockPublicKeyObj = {
      toBase58: vi.fn().mockReturnValue(testPublicKey),
      equals: vi.fn().mockReturnValue(true),
      toBytes: vi.fn(),
      toBuffer: vi.fn(),
      toJSON: vi.fn(),
      toString: vi.fn(),
    };

    const mockKeypairObj = {
      publicKey: mockPublicKeyObj,
      secretKey: new Uint8Array(64).fill(1),
      _keypair: { secretKey: new Uint8Array(64).fill(1) },
    };

    // Setup common mock behaviors
    mockShardingService.getDeviceId.mockReturnValue(testDeviceId);
    mockSolanaService.getKeypair.mockReturnValue(mockKeypairObj as unknown as Keypair);
    mockAttestationService.validateAttestationDocument.mockResolvedValue({
      validated: true,
      publicKey: 'mock-attestation-public-key',
    });
  });

  describe('BaseEventHandler', () => {
    it('should measure function execution time in callback', async () => {
      const handler = new CreateSignerEventHandler(
        mockCrossmintApiService,
        mockShardingService,
        mockSolanaService
      );
      const testInput: SignerInputEvent<'create-signer'> = {
        authData: testAuthData,
        data: { authId: 'test-auth-id', chainLayer: 'solana' },
      };

      mockCrossmintApiService.createSigner.mockResolvedValue({} as Response);
      const spy = vi.spyOn(handler, 'handler');

      await handler.callback(testInput);

      expect(spy).toHaveBeenCalledWith(testInput, undefined);
    });
  });

  describe('AttestedEventHandler', () => {
    it('should validate attestation document before calling handler', async () => {
      const handler = new SendOtpEventHandler(
        mockCrossmintApiService,
        mockShardingService,
        mockSolanaService,
        mockAttestationService
      );
      const testInput: SignerInputEvent<'send-otp'> = {
        authData: testAuthData,
        data: { encryptedOtp: '123456', chainLayer: 'solana' },
      };

      await handler.callback(testInput);

      expect(mockAttestationService.validateAttestationDocument).toHaveBeenCalled();
    });
  });

  describe('CreateSignerEventHandler', () => {
    it('should have correct event names', () => {
      const handler = new CreateSignerEventHandler(
        mockCrossmintApiService,
        mockShardingService,
        mockSolanaService
      );
      expect(handler.event).toBe('request:create-signer');
      expect(handler.responseEvent).toBe('response:create-signer');
    });

    it('should call createSigner with correct parameters when device share is null', async () => {
      const handler = new CreateSignerEventHandler(
        mockCrossmintApiService,
        mockShardingService,
        mockSolanaService
      );
      const testInput: SignerInputEvent<'create-signer'> = {
        authData: testAuthData,
        data: { authId: 'test-auth-id', chainLayer: 'solana' },
      };

      mockCrossmintApiService.createSigner.mockResolvedValue({} as Response);
      mockShardingService.getDeviceShare.mockReturnValue(null);

      const result = await handler.handler(testInput);

      expect(mockShardingService.getDeviceId).toHaveBeenCalledOnce();
      expect(mockCrossmintApiService.createSigner).toHaveBeenCalledWith(
        testDeviceId,
        testInput.authData,
        { authId: 'test-auth-id', chainLayer: 'solana' }
      );
      expect(mockAttestationService.validateAttestationDocument).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });

  describe('SendOtpEventHandler', () => {
    it('should have correct event names', () => {
      const handler = new SendOtpEventHandler(
        mockCrossmintApiService,
        mockShardingService,
        mockSolanaService,
        mockAttestationService
      );
      expect(handler.event).toBe('request:send-otp');
      expect(handler.responseEvent).toBe('response:send-otp');
    });

    it('should process OTP and store key shards', async () => {
      const handler = new SendOtpEventHandler(
        mockCrossmintApiService,
        mockShardingService,
        mockSolanaService,
        mockAttestationService
      );
      const testInput: SignerInputEvent<'send-otp'> = {
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
      const masterSecret = new Uint8Array(32).fill(1);
      mockShardingService.getMasterSecret.mockResolvedValue(masterSecret);

      const result = await handler.handler(testInput);

      expect(mockShardingService.getDeviceId).toHaveBeenCalled();
      expect(mockCrossmintApiService.sendOtp).toHaveBeenCalledWith(testDeviceId, testAuthData, {
        otp: '123456',
      });

      expect(mockShardingService.storeDeviceShare).toHaveBeenCalledWith('device-share-base64');
      expect(mockShardingService.cacheAuthShare).toHaveBeenCalledWith('auth-share-base64');

      expect(mockShardingService.getMasterSecret).toHaveBeenCalledWith(testAuthData);
      expect(mockSolanaService.getKeypair).toHaveBeenCalledWith(masterSecret);

      expect(result).toEqual({ address: testPublicKey });
      expect(mockAttestationService.validateAttestationDocument).not.toHaveBeenCalled();
    });
  });

  describe('GetPublicKeyEventHandler', () => {
    it('should have correct event names', () => {
      const handler = new GetPublicKeyEventHandler(mockShardingService, mockSolanaService);
      expect(handler.event).toBe('request:get-public-key');
      expect(handler.responseEvent).toBe('response:get-public-key');
    });

    it('should retrieve and reconstruct the key', async () => {
      const handler = new GetPublicKeyEventHandler(mockShardingService, mockSolanaService);
      const testInput: SignerInputEvent<'get-public-key'> = {
        authData: testAuthData,
        data: {
          chainLayer: 'solana',
        },
      };

      const masterSecret = new Uint8Array(32).fill(1);
      mockShardingService.getMasterSecret.mockResolvedValue(masterSecret);

      const result = await handler.handler(testInput);

      expect(mockShardingService.getMasterSecret).toHaveBeenCalledWith(testAuthData);
      expect(mockSolanaService.getKeypair).toHaveBeenCalledWith(masterSecret);

      expect(result).toEqual({ publicKey: testPublicKey });

      expect(mockAttestationService.validateAttestationDocument).not.toHaveBeenCalled();
    });
  });

  describe('SignMessageEventHandler', () => {
    it('should have correct event names', () => {
      const handler = new SignMessageEventHandler(mockShardingService, mockSolanaService);
      expect(handler.event).toBe('request:sign-message');
      expect(handler.responseEvent).toBe('response:sign-message');
    });

    it('should sign a message for supported chain layers', async () => {
      const handler = new SignMessageEventHandler(mockShardingService, mockSolanaService);
      const testInput: SignerInputEvent<'sign-message'> = {
        authData: testAuthData,
        data: {
          chainLayer: 'solana',
          message: 'test-message-base58',
          encoding: 'base58',
        },
      };

      const masterSecret = new Uint8Array(32).fill(1);
      mockShardingService.getMasterSecret.mockResolvedValue(masterSecret);
      mockSolanaService.signMessage.mockResolvedValue('test-signature');

      const result = await handler.handler(testInput);

      expect(mockShardingService.getMasterSecret).toHaveBeenCalledWith(testAuthData);
      expect(mockSolanaService.getKeypair).toHaveBeenCalledWith(masterSecret);
      expect(mockSolanaService.signMessage).toHaveBeenCalledWith(
        'test-message-base58',
        expect.any(Object)
      );

      expect(result).toEqual({
        signature: 'test-signature',
        publicKey: testPublicKey,
      });

      expect(mockAttestationService.validateAttestationDocument).not.toHaveBeenCalled();
    });

    it('should throw "Not implemented" error for unsupported chain layers', async () => {
      const handler = new SignMessageEventHandler(mockShardingService, mockSolanaService);
      const testInput: SignerInputEvent<'sign-message'> = {
        authData: testAuthData,
        data: {
          chainLayer: 'evm', // Use EVM to trigger the 'not implemented' error
          message: 'test message', // Use a string message
          encoding: 'base58', // Add required encoding property
        },
      };

      await expect(handler.handler(testInput)).rejects.toThrow('Chain layer not implemented');
    });
  });

  describe('SignTransactionEventHandler', () => {
    const serializedTransaction = 'base58-encoded-transaction';

    beforeEach(() => {
      const masterSecret = new Uint8Array(32).fill(1);
      mockShardingService.getMasterSecret.mockResolvedValue(masterSecret);

      mockSolanaService.signTransaction.mockResolvedValue({
        transaction: 'encoded-transaction',
        signature: 'encoded-transaction',
      });
    });

    it('should have correct event names', () => {
      const handler = new SignTransactionEventHandler(mockShardingService, mockSolanaService);
      expect(handler.event).toBe('request:sign-transaction');
      expect(handler.responseEvent).toBe('response:sign-transaction');
    });

    it('should sign the transaction', async () => {
      const handler = new SignTransactionEventHandler(mockShardingService, mockSolanaService);
      const testInput: SignerInputEvent<'sign-transaction'> = {
        authData: testAuthData,
        data: {
          transaction: serializedTransaction,
          chainLayer: 'solana',
          encoding: 'base58',
        },
      };

      const result = await handler.handler(testInput);

      expect(mockShardingService.getMasterSecret).toHaveBeenCalledWith(testAuthData);

      expect(result).toEqual({
        publicKey: testPublicKey,
        transaction: 'encoded-transaction',
        signature: 'encoded-transaction',
      });
    });
  });
});
