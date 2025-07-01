import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceService } from './device';
import { KeyPairProvider, ECDH_KEY_SPEC } from '@crossmint/client-signers-cryptography';

const IDENTITY_KEY_PERMISSIONS: KeyUsage[] = ['deriveBits', 'deriveKey'];

describe('DeviceService - Key Pair Based Device ID Tests', () => {
  let service: DeviceService;
  let mockKeyProvider: KeyPairProvider;
  let mockKeyPair1: CryptoKeyPair;
  let mockKeyPair2: CryptoKeyPair;

  beforeEach(async () => {
    vi.resetAllMocks();

    // Create two different key pairs for testing using the same method as encryption key provider
    mockKeyPair1 = await crypto.subtle.generateKey(ECDH_KEY_SPEC, true, IDENTITY_KEY_PERMISSIONS);

    mockKeyPair2 = await crypto.subtle.generateKey(ECDH_KEY_SPEC, true, IDENTITY_KEY_PERMISSIONS);

    mockKeyProvider = {
      getKeyPair: vi.fn(),
    } as unknown as KeyPairProvider;

    // Suppress console output in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('Should generate different device IDs for different key pairs', async () => {
    // Configure mock to return first key pair
    vi.mocked(mockKeyProvider.getKeyPair).mockResolvedValueOnce(mockKeyPair1);
    const service1 = new DeviceService(mockKeyProvider);
    const deviceId1 = await service1.getId();

    // Configure mock to return second key pair
    vi.mocked(mockKeyProvider.getKeyPair).mockResolvedValueOnce(mockKeyPair2);
    const service2 = new DeviceService(mockKeyProvider);
    const deviceId2 = await service2.getId();

    expect(deviceId1).not.toBe(deviceId2);
    expect(deviceId1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    expect(deviceId2).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
  });

  it('Should generate the same device ID for the same key pair', async () => {
    // Configure mock to return the same key pair for both calls
    vi.mocked(mockKeyProvider.getKeyPair)
      .mockResolvedValueOnce(mockKeyPair1)
      .mockResolvedValueOnce(mockKeyPair1);

    const service1 = new DeviceService(mockKeyProvider);
    const service2 = new DeviceService(mockKeyProvider);

    const deviceId1 = await service1.getId();
    const deviceId2 = await service2.getId();

    expect(deviceId1).toBe(deviceId2);
    expect(deviceId1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
  });

  it('Should work with non-extractable keys', async () => {
    // Create a non-extractable key pair using the same method as encryption key provider
    const nonExtractableKeyPair = await crypto.subtle.generateKey(
      ECDH_KEY_SPEC,
      false, // non-extractable
      IDENTITY_KEY_PERMISSIONS
    );

    vi.mocked(mockKeyProvider.getKeyPair).mockResolvedValue(nonExtractableKeyPair);
    service = new DeviceService(mockKeyProvider);

    const deviceId = await service.getId();

    expect(deviceId).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    expect(mockKeyProvider.getKeyPair).toHaveBeenCalled();
  });
});
