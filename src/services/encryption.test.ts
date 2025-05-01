import { expect, describe, it, beforeEach, vi } from 'vitest';
import { EncryptionService } from './encryption';
import { CipherSuite, HkdfSha384, Aes256Gcm, DhkemP384HkdfSha384 } from '@hpke/core';
import type { AttestationService } from './attestation';

// Mock the HPKE library
vi.mock('@hpke/core', () => {
  return {
    CipherSuite: vi.fn().mockImplementation(() => ({
      kem: {
        generateKeyPair: vi.fn().mockResolvedValue({
          publicKey: 'mockedPublicKey',
          privateKey: 'mockedPrivateKey',
        }),
        serializePublicKey: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
        serializePrivateKey: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
        deserializePublicKey: vi.fn().mockResolvedValue('mockedPublicKey'),
        deserializePrivateKey: vi.fn().mockResolvedValue('mockedPrivateKey'),
      },
      createSenderContext: vi.fn().mockResolvedValue({
        seal: vi
          .fn()
          .mockImplementation(data => Promise.resolve(new ArrayBuffer(data.length + 16))),
        enc: new ArrayBuffer(8),
      }),
      createRecipientContext: vi.fn().mockResolvedValue({
        open: vi.fn().mockImplementation(() => {
          // Return a usable JSON string when decrypting
          return Promise.resolve(
            new TextEncoder().encode(
              JSON.stringify({
                data: { message: 'Hello, encryption!', timestamp: 123456789 },
                encryptionContext: { senderPublicKey: 'base64PublicKey' },
              })
            )
          );
        }),
      }),
    })),
    DhkemP384HkdfSha384: vi.fn(),
    HkdfSha384: vi.fn(),
    Aes256Gcm: vi.fn(),
  };
});

// Mock localStorage and sessionStorage
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
};

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

// Mock AttestationService
const mockAttestationService: AttestationService = {
  name: 'Mock Attestation Service',
  attestationDoc: 'mockAttestationDoc',
  async init() {},
  async validateAttestationDoc() {
    return { validated: true };
  },
  async getPublicKeyFromAttestation() {
    return 'mockKey' as unknown as CryptoKey;
  },
  async getAttestation() {
    return 'mockAttestation';
  },
  assertInitialized() {
    return {} as Record<string, unknown>;
  },
} as unknown as AttestationService;

// Mock global methods
vi.stubGlobal(
  'btoa',
  vi.fn(str => 'base64encoded')
);
vi.stubGlobal(
  'atob',
  vi.fn(b64 => 'decoded')
);
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', sessionStorageMock);

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(async () => {
    // Clear mock storage
    localStorageMock.clear();
    sessionStorageMock.clear();

    // Reset all mocks
    vi.clearAllMocks();

    // Create a new instance for each test
    encryptionService = new EncryptionService(mockAttestationService);
    await encryptionService.init();
  });

  describe('core functionality', () => {
    it('should initialize correctly', async () => {
      expect(encryptionService).toBeDefined();

      // Reset mock counters
      vi.clearAllMocks();

      // Test initialization with existing key pair in localStorage
      localStorageMock.getItem
        .mockReturnValueOnce('mockPrivateKey')
        .mockReturnValueOnce('mockPublicKey');

      const newService = new EncryptionService(mockAttestationService);
      await newService.init();

      expect(localStorageMock.getItem).toHaveBeenCalledTimes(2);
    });

    it('should handle localStorage initialization errors', async () => {
      // Reset mock counters
      vi.clearAllMocks();

      // Setup localStorage to throw an error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const newService = new EncryptionService(mockAttestationService);
      await newService.init();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should encrypt and decrypt data successfully', async () => {
      // Test data to encrypt
      const testData = {
        message: 'Hello, encryption!',
        timestamp: Date.now(),
      };

      // Setup text decoder mock
      vi.spyOn(global, 'TextDecoder').mockImplementation(
        () =>
          ({
            decode: () =>
              JSON.stringify({
                data: {
                  message: 'Hello, encryption!',
                  timestamp: 123456789,
                },
                encryptionContext: { senderPublicKey: 'base64PublicKey' },
              }),
          }) as TextDecoder
      );

      // Test standard encryption
      const { ciphertext, encapsulatedKey, publicKey } = await encryptionService.encrypt(testData);
      expect(ciphertext).toBeDefined();
      expect(encapsulatedKey).toBeDefined();
      expect(publicKey).toBeDefined();

      // Test standard decryption
      const decryptedData = await encryptionService.decrypt(ciphertext, encapsulatedKey);
      expect(decryptedData).toHaveProperty('data');
      expect(decryptedData.data).toHaveProperty('message', 'Hello, encryption!');
      expect(decryptedData.data).toHaveProperty('timestamp');

      // Test base64 encryption/decryption
      const base64Result = await encryptionService.encryptBase64(testData);
      expect(base64Result.ciphertext).toBe('base64encoded');
      expect(base64Result.encapsulatedKey).toBe('base64encoded');

      const decryptedBase64 = await encryptionService.decryptBase64(
        base64Result.ciphertext,
        base64Result.encapsulatedKey
      );
      expect(decryptedBase64).toBeDefined();
    });
  });

  describe('utility methods', () => {
    it('should provide encryption data and public key', async () => {
      // Test getEncryptionData
      const encryptionData = await encryptionService.getEncryptionData();
      expect(encryptionData).toHaveProperty('publicKey');
      expect(encryptionData).toHaveProperty('type', 'P384');
      expect(encryptionData).toHaveProperty('encoding', 'base64');

      // Test getPublicKey
      const publicKey = await encryptionService.getPublicKey();
      expect(publicKey).toBeDefined();
    });

    it('should throw when not initialized', async () => {
      // Create an uninitialized service
      const uninitializedService = new EncryptionService(mockAttestationService);

      // Test encryption fails
      await expect(uninitializedService.encrypt({ test: 'data' })).rejects.toThrow(
        'EncryptionService not initialized'
      );

      // Test getEncryptionData fails
      await expect(uninitializedService.getEncryptionData()).rejects.toThrow(
        'EncryptionService not initialized'
      );

      // Test getPublicKey fails
      await expect(uninitializedService.getPublicKey()).rejects.toThrow(
        'EncryptionService not initialized'
      );
    });
  });
});
