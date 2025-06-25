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
  encryptedMasterKey: 'encrypted-master-key-json',
  signerId: 'test-signer-id',
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
    it('should skip API call if master secret already exists', async () => {
      const handler = new StartOnboardingEventHandler(mockServices);
      const testInput: SignerInputEvent<'start-onboarding'> = {
        authData: TEST_FIXTURES.authData,
        data: { authId: 'test-auth-id' },
      };

      mockServices.keyManager.getMasterSecret.mockResolvedValue(TEST_FIXTURES.masterSecret);
      mockServices.cryptoKey.getAllPublicKeysFromSeed.mockResolvedValue({
        ed25519: { bytes: TEST_FIXTURES.publicKey, encoding: 'base58', keyType: 'ed25519' },
        secp256k1: { bytes: 'test-secp256k1-public-key', encoding: 'hex', keyType: 'secp256k1' },
      });

      await handler.handler(testInput);

      expect(mockServices.api.startOnboarding).not.toHaveBeenCalled();
    });
  });

  describe('CompleteOnboardingEventHandler', () => {
    it('should process OTP flow correctly and store encrypted master key', async () => {
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
        encryptedMasterKey: TEST_FIXTURES.encryptedMasterKey,
        signerId: TEST_FIXTURES.signerId,
      });

      mockServices.keyManager.getMasterSecret.mockResolvedValue(TEST_FIXTURES.masterSecret);
      mockServices.cryptoKey.getAllPublicKeysFromSeed.mockResolvedValue({
        ed25519: {
          bytes: TEST_FIXTURES.publicKey,
          encoding: 'base58',
          keyType: 'ed25519',
        },
        secp256k1: {
          bytes: 'test-secp256k1-public-key',
          encoding: 'hex',
          keyType: 'secp256k1',
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

      expect(mockServices.keyManager.setEncryptedMasterKey).toHaveBeenCalledWith(
        TEST_FIXTURES.signerId,
        TEST_FIXTURES.encryptedMasterKey
      );
      expect(result).toHaveProperty('publicKeys');
    });
  });

  describe('SignEventHandler', () => {
    it('should properly handle errors when master secret is not found', async () => {
      const handler = new SignEventHandler(mockServices);
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

      const mockError = new Error('Master secret not found');
      mockServices.keyManager.getMasterSecret.mockRejectedValue(mockError);

      const result = await handler.callback(testInput);

      expect(mockServices.keyManager.getMasterSecret).toHaveBeenCalledWith(testInput.authData);
      expect(result).toEqual({
        status: 'error',
        error: mockError.message,
      });
    });
  });
});
