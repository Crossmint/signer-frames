import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StartOnboardingEventHandler,
  CompleteOnboardingEventHandler,
  SignEventHandler,
} from './handlers';
import { createMockServices } from '../../tests/test-utils';
import type { SignerInputEvent } from '@crossmint/client-signers';
import bs58 from 'bs58';
import { CrossmintFrameCodedError } from '../api/error';

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
    mockServices.device.getId.mockReturnValue(TEST_FIXTURES.deviceId);
    mockServices.attestation.getAttestedPublicKey.mockResolvedValue('mock-attestation-public-key');
  });

  describe('StartOnboardingEventHandler', () => {
    it('should skip API call if device share already exists', async () => {
      const handler = new StartOnboardingEventHandler(mockServices);
      const testInput: SignerInputEvent<'start-onboarding'> = {
        authData: TEST_FIXTURES.authData,
        data: { authId: 'test-auth-id' },
      };

      mockServices.sharding.reconstructMasterSecret.mockResolvedValue(TEST_FIXTURES.masterSecret);
      mockServices.cryptoKey.getPublicKeyFromSeed.mockResolvedValue({
        bytes: TEST_FIXTURES.publicKey,
        encoding: 'base58',
        keyType: 'ed25519',
      });

      await handler.handler(testInput);

      expect(mockServices.api.startOnboarding).not.toHaveBeenCalled();
    });
  });

  describe('CompleteOnboardingEventHandler', () => {
    it('should process OTP flow correctly and store key shards', async () => {
      const handler = new CompleteOnboardingEventHandler(mockServices);
      const testInput: SignerInputEvent<'complete-onboarding'> = {
        authData: TEST_FIXTURES.authData,
        data: {
          onboardingAuthentication: {
            encryptedOtp: '123456',
          },
        },
      };

      mockServices.fpe.decrypt.mockResolvedValue([1, 2, 3, 4, 5, 6]);

      mockServices.api.completeOnboarding.mockResolvedValue({
        deviceKeyShare: TEST_FIXTURES.shares.device,
        signerId: 'test-signer-id',
      });

      mockServices.sharding.reconstructMasterSecret.mockResolvedValue(TEST_FIXTURES.masterSecret);
      mockServices.ed25519.secretKeyFromSeed.mockResolvedValue(TEST_FIXTURES.secretKey);
      mockServices.ed25519.getPublicKey.mockResolvedValue(
        bs58.encode(TEST_FIXTURES.secretKey.slice(32))
      );
      mockServices.cryptoKey.getAllPublicKeysFromSeed.mockResolvedValue({
        ed25519: {
          bytes: TEST_FIXTURES.publicKey,
          encoding: 'base58',
        },
        secp256k1: {
          bytes: 'test-secp256k1-public-key',
          encoding: 'hex',
        },
      });

      const result = await handler.handler(testInput);

      expect(mockServices.api.completeOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardingAuthentication: { otp: '123456' },
          deviceId: TEST_FIXTURES.deviceId,
        }),
        testInput.authData
      );

      expect(mockServices.sharding.storeDeviceShare).toHaveBeenCalledWith(
        'test-signer-id',
        TEST_FIXTURES.shares.device
      );
      expect(result).toHaveProperty('publicKeys');
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
      const mockError = new CrossmintFrameCodedError(
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
