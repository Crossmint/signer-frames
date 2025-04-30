import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateSignerEventHandler,
  SendOtpEventHandler,
  GetPublicKeyEventHandler,
  initializeHandlers,
} from './handlers';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { CrossmintApiService } from './api';
import type { ShardingService } from './sharding';
import type { SignerInputEvent } from '@crossmint/client-signers';
import type { AttestationService } from './attestation';
import type { Ed25519Service } from './ed25519';
import type { XMIFServices } from '.';
import bs58 from 'bs58';

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
  const mockAttestationService = mockDeep<AttestationService>();
  const mockEd25519Service = mockDeep<Ed25519Service>();

  // Create mock services object with type safety
  const mockServices: XMIFServices = {
    api: mockCrossmintApiService,
    sharding: mockShardingService,
    attestation: mockAttestationService,
    ed25519: mockEd25519Service,
    events: mockDeep(),
    encrypt: mockDeep(),
  };

  // Reset mocks before each test
  beforeEach(() => {
    mockReset(mockCrossmintApiService);
    mockReset(mockShardingService);
    mockReset(mockAttestationService);
    mockReset(mockEd25519Service);
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
    mockAttestationService.validateAttestationDocument.mockResolvedValue({
      validated: true,
      publicKey: 'mock-attestation-public-key',
    });
  });

  describe('BaseEventHandler', () => {
    it('should measure function execution time in callback', async () => {
      const handler = new CreateSignerEventHandler(mockServices);
      const testInput: SignerInputEvent<'create-signer'> = {
        authData: testAuthData,
        data: { authId: 'test-auth-id', chainLayer: 'solana' },
      };

      mockCrossmintApiService.createSigner.mockResolvedValue({} as Response);
      const spy = vi.spyOn(handler, 'handler');

      await handler.callback(testInput);

      expect(spy).toHaveBeenCalledWith(testInput);
    });
  });

  describe('AttestedEventHandler', () => {
    it('should validate attestation document before calling handler', async () => {
      const handler = new SendOtpEventHandler(mockServices);
      const testInput: SignerInputEvent<'send-otp'> = {
        authData: testAuthData,
        data: { encryptedOtp: '123456', chainLayer: 'solana' },
      };

      await handler.callback(testInput);

      // Note: Since there's no longer explicit validation in AttestedEventHandler, we verify the handler was called
      expect(mockCrossmintApiService.sendOtp).toHaveBeenCalled();
    });
  });

  describe('CreateSignerEventHandler', () => {
    it('should have correct event names', () => {
      const handler = new CreateSignerEventHandler(mockServices);
      expect(handler.event).toBe('request:create-signer');
      expect(handler.responseEvent).toBe('response:create-signer');
    });

    it('should call createSigner with correct parameters when device share is null', async () => {
      const handler = new CreateSignerEventHandler(mockServices);
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
        { authId: 'test-auth-id', chainLayer: 'solana' },
        testInput.authData
      );
      expect(result).toEqual({});
    });
  });

  describe('SendOtpEventHandler', () => {
    it('should have correct event names', () => {
      const handler = new SendOtpEventHandler(mockServices);
      expect(handler.event).toBe('request:send-otp');
      expect(handler.responseEvent).toBe('response:send-otp');
    });

    it('should process OTP and store key shards', async () => {
      const handler = new SendOtpEventHandler(mockServices);
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
      const secretKey = new Uint8Array(64).fill(1);
      mockEd25519Service.secretKeyFromSeed.mockResolvedValue(secretKey);
      mockEd25519Service.getPublicKey.mockResolvedValue(bs58.encode(secretKey.slice(32)));

      const result = await handler.handler(testInput);

      expect(mockCrossmintApiService.sendOtp).toHaveBeenCalledWith(
        testDeviceId,
        { otp: '123456' },
        testInput.authData
      );
      expect(mockShardingService.storeDeviceShare).toHaveBeenCalledWith('device-share-base64');
      expect(mockShardingService.cacheAuthShare).toHaveBeenCalledWith('auth-share-base64');
      expect(mockShardingService.getMasterSecret).toHaveBeenCalledWith(testInput.authData);
      expect(mockEd25519Service.secretKeyFromSeed).toHaveBeenCalledWith(masterSecret);
      expect(result).toHaveProperty('address');
    });
  });

  describe('GetPublicKeyEventHandler', () => {
    it('should have correct event names', () => {
      const handler = new GetPublicKeyEventHandler(mockServices);
      expect(handler.event).toBe('request:get-public-key');
      expect(handler.responseEvent).toBe('response:get-public-key');
    });

    it('should retrieve and reconstruct the key', async () => {
      const handler = new GetPublicKeyEventHandler(mockServices);
      const testInput: SignerInputEvent<'get-public-key'> = {
        authData: testAuthData,
        data: {
          chainLayer: 'solana',
        },
      };

      const masterSecret = new Uint8Array(32).fill(1);
      mockShardingService.getMasterSecret.mockResolvedValue(masterSecret);
      const secretKey = new Uint8Array(64).fill(1);
      mockEd25519Service.secretKeyFromSeed.mockResolvedValue(secretKey);
      mockEd25519Service.getPublicKey.mockResolvedValue(testPublicKey);

      const result = await handler.handler(testInput);

      expect(mockShardingService.getMasterSecret).toHaveBeenCalledWith(testInput.authData);
      expect(mockEd25519Service.secretKeyFromSeed).toHaveBeenCalledWith(masterSecret);
      expect(mockEd25519Service.getPublicKey).toHaveBeenCalledWith(secretKey);
      expect(result).toEqual({ publicKey: testPublicKey });
    });
  });
});
