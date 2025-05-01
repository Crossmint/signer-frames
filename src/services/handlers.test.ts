import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateSignerEventHandler,
  SendOtpEventHandler,
  GetPublicKeyEventHandler,
} from './handlers';
import { createMockServices } from '../tests/test-utils';
import type { SignerInputEvent } from '@crossmint/client-signers';
import bs58 from 'bs58';

const TEST_FIXTURES = {
  deviceId: 'test-device-id',
  authData: {
    jwt: 'test-jwt',
    apiKey: 'test-api-key',
  },
  publicKey: 'test-public-key',
  shares: {
    auth: 'auth-share-base64',
    device: 'device-share-base64',
  },
  masterSecret: new Uint8Array(32).fill(1),
  secretKey: new Uint8Array(64).fill(1),
};

describe('EventHandlers', () => {
  const mockServices = createMockServices();

  beforeEach(() => {
    vi.clearAllMocks();
    mockServices.sharding.getDeviceId.mockReturnValue(TEST_FIXTURES.deviceId);
    mockServices.attestation.getPublicKeyFromAttestation.mockResolvedValue(
      'mock-attestation-public-key'
    );
  });

  describe('CreateSignerEventHandler', () => {
    it('should have correct event mapping names', () => {
      const handler = new CreateSignerEventHandler(mockServices);
      expect(handler.event).toBe('request:create-signer');
      expect(handler.responseEvent).toBe('response:create-signer');
    });

    it('should call createSigner API with correct parameters when device share does not exist', async () => {
      const handler = new CreateSignerEventHandler(mockServices);
      const testInput: SignerInputEvent<'create-signer'> = {
        authData: TEST_FIXTURES.authData,
        data: { authId: 'test-auth-id', chainLayer: 'solana' },
      };

      mockServices.api.createSigner.mockResolvedValue({} as Response);
      mockServices.sharding.getDeviceShare.mockReturnValue(null);

      await handler.handler(testInput);

      expect(mockServices.sharding.getDeviceId).toHaveBeenCalledOnce();
      expect(mockServices.api.createSigner).toHaveBeenCalledWith(
        TEST_FIXTURES.deviceId,
        { authId: 'test-auth-id', chainLayer: 'solana' },
        testInput.authData
      );
    });

    it('should skip API call if device share already exists', async () => {
      const handler = new CreateSignerEventHandler(mockServices);
      const testInput: SignerInputEvent<'create-signer'> = {
        authData: TEST_FIXTURES.authData,
        data: { authId: 'test-auth-id', chainLayer: 'solana' },
      };

      mockServices.sharding.getDeviceShare.mockReturnValue(TEST_FIXTURES.shares.device);

      await handler.handler(testInput);

      expect(mockServices.api.createSigner).not.toHaveBeenCalled();
    });

    it('should measure execution time in callback wrapper', async () => {
      const handler = new CreateSignerEventHandler(mockServices);
      const testInput: SignerInputEvent<'create-signer'> = {
        authData: TEST_FIXTURES.authData,
        data: { authId: 'test-auth-id', chainLayer: 'solana' },
      };

      mockServices.api.createSigner.mockResolvedValue({} as Response);
      const spy = vi.spyOn(handler, 'handler');

      await handler.callback(testInput);

      expect(spy).toHaveBeenCalledWith(testInput);
    });
  });

  describe('SendOtpEventHandler', () => {
    it('should have correct event mapping names', () => {
      const handler = new SendOtpEventHandler(mockServices);
      expect(handler.event).toBe('request:send-otp');
      expect(handler.responseEvent).toBe('response:send-otp');
    });

    it('should process OTP flow correctly and store key shards', async () => {
      const handler = new SendOtpEventHandler(mockServices);
      const testInput: SignerInputEvent<'send-otp'> = {
        authData: TEST_FIXTURES.authData,
        data: {
          encryptedOtp: '123456',
          chainLayer: 'solana',
        },
      };

      mockServices.api.sendOtp.mockResolvedValue({
        shares: TEST_FIXTURES.shares,
      });

      mockServices.sharding.getMasterSecret.mockResolvedValue(TEST_FIXTURES.masterSecret);
      mockServices.ed25519.secretKeyFromSeed.mockResolvedValue(TEST_FIXTURES.secretKey);
      mockServices.ed25519.getPublicKey.mockResolvedValue(
        bs58.encode(TEST_FIXTURES.secretKey.slice(32))
      );

      const result = await handler.handler(testInput);

      expect(mockServices.api.sendOtp).toHaveBeenCalledWith(
        TEST_FIXTURES.deviceId,
        { otp: '123456' },
        testInput.authData
      );

      expect(mockServices.sharding.storeDeviceShare).toHaveBeenCalledWith(
        TEST_FIXTURES.shares.device
      );
      expect(mockServices.sharding.cacheAuthShare).toHaveBeenCalledWith(TEST_FIXTURES.shares.auth);

      expect(mockServices.sharding.getMasterSecret).toHaveBeenCalledWith(testInput.authData);
      expect(mockServices.ed25519.secretKeyFromSeed).toHaveBeenCalledWith(
        TEST_FIXTURES.masterSecret
      );

      expect(result).toHaveProperty('address');
    });
  });

  describe('GetPublicKeyEventHandler', () => {
    it('should have correct event mapping names', () => {
      const handler = new GetPublicKeyEventHandler(mockServices);
      expect(handler.event).toBe('request:get-public-key');
      expect(handler.responseEvent).toBe('response:get-public-key');
    });

    it('should retrieve and reconstruct the key correctly', async () => {
      const handler = new GetPublicKeyEventHandler(mockServices);
      const testInput: SignerInputEvent<'get-public-key'> = {
        authData: TEST_FIXTURES.authData,
        data: {
          chainLayer: 'solana',
        },
      };

      mockServices.sharding.getMasterSecret.mockResolvedValue(TEST_FIXTURES.masterSecret);
      mockServices.ed25519.secretKeyFromSeed.mockResolvedValue(TEST_FIXTURES.secretKey);
      mockServices.ed25519.getPublicKey.mockResolvedValue(TEST_FIXTURES.publicKey);

      const result = await handler.handler(testInput);

      expect(mockServices.sharding.getMasterSecret).toHaveBeenCalledWith(testInput.authData);
      expect(mockServices.ed25519.secretKeyFromSeed).toHaveBeenCalledWith(
        TEST_FIXTURES.masterSecret
      );
      expect(mockServices.ed25519.getPublicKey).toHaveBeenCalledWith(TEST_FIXTURES.secretKey);

      expect(result).toEqual({ publicKey: TEST_FIXTURES.publicKey });
    });
  });
});
