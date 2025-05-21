import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateSignerEventHandler,
  SendOtpEventHandler,
  GetPublicKeyEventHandler,
  SignEventHandler,
} from './handlers';
import { createMockServices } from '../tests/test-utils';
import type { SignerInputEvent } from '@crossmint/client-signers';
import bs58 from 'bs58';
import { XMIFCodedError } from './error';

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
    it('should skip API call if device share already exists', async () => {
      const handler = new CreateSignerEventHandler(mockServices);
      const testInput: SignerInputEvent<'create-signer'> = {
        authData: TEST_FIXTURES.authData,
        data: { authId: 'test-auth-id', keyType: 'ed25519' },
      };

      mockServices.sharding.status.mockReturnValue('ready');
      mockServices.sharding.reconstructMasterSecret.mockResolvedValue(TEST_FIXTURES.masterSecret);
      mockServices.cryptoKey.getPublicKeyFromSeed.mockResolvedValue({
        bytes: TEST_FIXTURES.publicKey,
        encoding: 'base58',
        keyType: 'ed25519',
      });

      await handler.handler(testInput);

      expect(mockServices.api.createSigner).not.toHaveBeenCalled();
    });
  });

  describe('SendOtpEventHandler', () => {
    it('should process OTP flow correctly and store key shards', async () => {
      const handler = new SendOtpEventHandler(mockServices);
      const testInput: SignerInputEvent<'send-otp'> = {
        authData: TEST_FIXTURES.authData,
        data: {
          encryptedOtp: '123456',
          keyType: 'ed25519',
        },
      };

      mockServices.fpe.decrypt.mockResolvedValue([1, 2, 3, 4, 5, 6]);

      mockServices.api.sendOtp.mockResolvedValue({
        shares: TEST_FIXTURES.shares,
      });

      mockServices.sharding.reconstructMasterSecret.mockResolvedValue(TEST_FIXTURES.masterSecret);
      mockServices.ed25519.secretKeyFromSeed.mockResolvedValue(TEST_FIXTURES.secretKey);
      mockServices.ed25519.getPublicKey.mockResolvedValue(
        bs58.encode(TEST_FIXTURES.secretKey.slice(32))
      );
      mockServices.cryptoKey.getPublicKeyFromSeed.mockResolvedValue({
        bytes: TEST_FIXTURES.publicKey,
        encoding: 'base58',
        keyType: 'ed25519',
      });

      const result = await handler.handler(testInput);

      expect(mockServices.api.sendOtp).toHaveBeenCalledWith(
        TEST_FIXTURES.deviceId,
        expect.objectContaining({ otp: '123456' }),
        testInput.authData
      );

      expect(mockServices.sharding.storeDeviceShare).toHaveBeenCalledWith(
        TEST_FIXTURES.shares.device
      );
      expect(result).toHaveProperty('publicKey');
    });
  });

  describe('GetPublicKeyEventHandler', () => {
    it('should retrieve and reconstruct the key correctly', async () => {
      const handler = new GetPublicKeyEventHandler(mockServices);
      const testInput: SignerInputEvent<'get-public-key'> = {
        authData: TEST_FIXTURES.authData,
        data: {
          keyType: 'ed25519',
        },
      };

      mockServices.sharding.reconstructMasterSecret.mockResolvedValue(TEST_FIXTURES.masterSecret);
      mockServices.cryptoKey.getPublicKeyFromSeed.mockResolvedValue({
        bytes: TEST_FIXTURES.publicKey,
        encoding: 'base58',
        keyType: 'ed25519',
      });

      const result = await handler.handler(testInput);

      expect(mockServices.sharding.reconstructMasterSecret).toHaveBeenCalledWith(
        testInput.authData
      );
      expect(mockServices.cryptoKey.getPublicKeyFromSeed).toHaveBeenCalledWith(
        testInput.data.keyType,
        TEST_FIXTURES.masterSecret
      );
      expect(result).toEqual({
        publicKey: {
          bytes: TEST_FIXTURES.publicKey,
          encoding: 'base58',
          keyType: 'ed25519',
        },
      });
    });
  });

  describe('SignEventHandler', () => {
    it('should properly handle invalid device share errors', async () => {
      // Create the handler directly like other tests
      const handler = new SignEventHandler(mockServices);

      // Setup the test data
      const message = 'test message';
      const encodedMessage = bs58.encode(Buffer.from(message));
      const testInput: SignerInputEvent<'sign'> = {
        authData: TEST_FIXTURES.authData,
        data: {
          keyType: 'ed25519',
          bytes: encodedMessage,
          encoding: 'base58',
        },
      };

      // Mock the error that would be thrown when device share hash doesn't match
      const mockError = new XMIFCodedError(
        'Key share stored on this device does not match Crossmint held authentication share.',
        'invalid-device-share'
      );
      mockServices.sharding.reconstructMasterSecret.mockRejectedValue(mockError);

      // Test the whole event handler flow including error handling
      const result = await handler.callback(testInput);

      expect(mockServices.sharding.reconstructMasterSecret).toHaveBeenCalledWith(
        testInput.authData
      );
      expect(result).toEqual({
        status: 'error',
        error: mockError.message,
        code: 'invalid-device-share',
      });
    });
  });
});
