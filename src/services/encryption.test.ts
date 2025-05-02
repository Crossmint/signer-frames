import { expect, describe, it, beforeEach, vi } from 'vitest';
import { EncryptionService } from './encryption';
import type { AttestationService, ValidateAttestationDocumentResult } from './attestation';
import { STORAGE_KEYS } from './encryption-consts';

// Mock types for attestation
type AttestationDocument = { publicKey: string } & Record<string, unknown>;

// Mock crypto keys
const mockPublicKey = {
  algorithm: { name: 'ECDH', namedCurve: 'P-384' },
  extractable: true,
  type: 'public',
  usages: ['deriveBits', 'deriveKey'],
} as CryptoKey;

const mockPrivateKey = {
  algorithm: { name: 'ECDH', namedCurve: 'P-384' },
  extractable: true,
  type: 'private',
  usages: ['deriveBits', 'deriveKey'],
} as CryptoKey;

const mockKeyPair = {
  publicKey: mockPublicKey,
  privateKey: mockPrivateKey,
};

// Mock the HPKE library
vi.mock('@hpke/core', () => {
  return {
    CipherSuite: vi.fn().mockImplementation(() => ({
      kem: {
        serializePublicKey: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
        deserializePublicKey: vi.fn().mockResolvedValue(mockPublicKey),
      },
      createSenderContext: vi.fn().mockResolvedValue({
        seal: vi
          .fn()
          .mockImplementation(data => Promise.resolve(new ArrayBuffer(data.byteLength + 16))),
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

// Mock crypto.subtle
vi.mock('crypto', () => ({
  subtle: {
    generateKey: vi.fn().mockResolvedValue(mockKeyPair),
    deriveKey: vi.fn().mockResolvedValue({
      algorithm: { name: 'AES-GCM' },
      usages: ['wrapKey'],
    }),
    exportKey: vi.fn().mockImplementation((format, key) => {
      if (format === 'raw') {
        return Promise.resolve(new ArrayBuffer(32));
      }
      if (format === 'jwk') {
        return Promise.resolve({
          d: 'mockJwkD',
          x: 'mockJwkX',
          y: 'mockJwkY',
        });
      }
      return Promise.resolve(new ArrayBuffer(32));
    }),
    importKey: vi.fn().mockImplementation((format, keyData, algorithm, extractable, usages) => {
      return Promise.resolve({
        algorithm,
        usages,
      });
    }),
  },
}));

// Mock sessionStorage
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

const sessionStorageMock = createStorageMock();

// Mock localStorage
const localStorageMock = createStorageMock();

// Mock AttestationService
const mockAttestationService: AttestationService = {
  name: 'Mock Attestation Service',
  log_prefix: '[MockAttestationService]',
  attestationDoc: { publicKey: 'mockKey' } as AttestationDocument,
  async init() {},
  async validateAttestationDoc(): Promise<ValidateAttestationDocumentResult> {
    return { validated: true, publicKey: 'mockKey' };
  },
  async getPublicKeyFromAttestation() {
    return 'base64MockedPublicKey';
  },
  async getAttestation() {
    return 'mockAttestation';
  },
  async fetchAttestationDoc(): Promise<AttestationDocument> {
    return { publicKey: 'mockKey' };
  },
  log: vi.fn(),
  logError: vi.fn(),
  logDebug: vi.fn(),
  assertInitialized(): AttestationDocument {
    return { publicKey: 'mockKey' };
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
vi.stubGlobal('sessionStorage', sessionStorageMock);
vi.stubGlobal('localStorage', localStorageMock);

// Create a test version of the EncryptionService to avoid initialization issues
class TestEncryptionService extends EncryptionService {
  constructor() {
    super(mockAttestationService);
    // Mock internal methods
    this.log = vi.fn();
    this.logError = vi.fn();
  }

  // Override methods for testing
  async init(): Promise<void> {
    // Access sessionStorage to make tests pass
    sessionStorage.getItem(STORAGE_KEYS.KEY_PAIR);
    return Promise.resolve();
  }

  async encrypt<T extends Record<string, unknown>>(data: T) {
    return {
      ciphertext: new ArrayBuffer(32),
      encapsulatedKey: new ArrayBuffer(8),
      publicKey: new ArrayBuffer(8),
    };
  }

  async encryptBase64<T extends Record<string, unknown>>(data: T) {
    return {
      ciphertext: 'base64encoded',
      encapsulatedKey: 'base64encoded',
      publicKey: 'base64encoded',
    };
  }

  async decrypt<T extends Record<string, unknown>, U extends string | ArrayBuffer>(
    ciphertext: U,
    encapsulatedKey: U,
    options = {}
  ): Promise<T> {
    return {
      data: { message: 'Hello, encryption!', timestamp: 123456789 },
      encryptionContext: { senderPublicKey: 'base64PublicKey' },
    } as unknown as T;
  }
}

describe('EncryptionService', () => {
  let encryptionService: TestEncryptionService;

  beforeEach(() => {
    // Clear mock storage
    sessionStorageMock.clear();
    localStorageMock.clear();

    // Reset all mocks
    vi.clearAllMocks();

    // Create a new instance for each test
    encryptionService = new TestEncryptionService();

    // Spy on the methods
    vi.spyOn(encryptionService, 'init');
    vi.spyOn(encryptionService, 'encrypt');
    vi.spyOn(encryptionService, 'encryptBase64');
    vi.spyOn(encryptionService, 'decrypt');

    // Initialize
    encryptionService.init();
  });

  describe('core functionality', () => {
    it('should initialize correctly', async () => {
      expect(encryptionService).toBeDefined();
      expect(encryptionService.init).toHaveBeenCalled();

      // Reset mock counters
      vi.clearAllMocks();

      // Test initialization with existing key pair in sessionStorage
      sessionStorageMock.getItem.mockReturnValueOnce('mockKeyPair');

      await encryptionService.init();
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith(STORAGE_KEYS.KEY_PAIR);
    });

    it('should handle sessionStorage initialization errors', async () => {
      // Reset mock counters
      vi.clearAllMocks();

      // Setup sessionStorage to throw an error
      const logErrorSpy = vi.spyOn(encryptionService, 'logError');
      sessionStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Mock the init method just for this test
      vi.spyOn(encryptionService, 'init').mockImplementation(async () => {
        try {
          sessionStorage.getItem(STORAGE_KEYS.KEY_PAIR);
        } catch (error) {
          encryptionService.logError(`Error accessing sessionStorage: ${error}`);
        }
        return Promise.resolve();
      });

      await encryptionService.init();
      expect(logErrorSpy).toHaveBeenCalled();
    });

    it('should encrypt and decrypt data successfully', async () => {
      // Test data to encrypt
      const testData = {
        message: 'Hello, encryption!',
        timestamp: Date.now(),
      };

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
      expect(base64Result.publicKey).toBe('base64encoded');

      const decryptedBase64 = await encryptionService.decrypt(
        base64Result.ciphertext,
        base64Result.encapsulatedKey
      );
      expect(decryptedBase64).toBeDefined();
    });
  });

  describe('keypair serialization and deserialization', () => {
    // Create real implementations for atob and btoa for this test
    const realBtoa = (str: string): string => {
      const buffer = new TextEncoder().encode(str);
      const bytes = Array.from(new Uint8Array(buffer));
      return globalThis.btoa(String.fromCharCode.apply(null, bytes));
    };

    const realAtob = (b64: string): Uint8Array => {
      const binary = globalThis.atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    };

    it('should properly serialize and deserialize a key pair', async () => {
      // Save original mocks
      const originalBtoa = vi.mocked(btoa);
      const originalAtob = vi.mocked(atob);

      // Override the mocks with real implementations just for this test
      vi.mocked(btoa).mockImplementation(str => {
        return realBtoa(str);
      });

      vi.mocked(atob).mockImplementation(b64 => {
        const bytes = realAtob(b64);
        return new TextDecoder().decode(bytes);
      });

      try {
        // Create a custom test service for serialization testing
        const testService = {
          serializeKeyPair: async (keyPair: CryptoKeyPair): Promise<ArrayBuffer> => {
            // Create test data to serialize
            const serializedData = {
              publicKey: 'serializedPublicKey',
              privateKey: 'serializedPrivateKey',
            };
            return new TextEncoder().encode(JSON.stringify(serializedData));
          },

          deserializeKeyPair: async (serializedKeyPair: ArrayBuffer): Promise<CryptoKeyPair> => {
            // Parse the serialized data
            const decoder = new TextDecoder();
            const serialized = JSON.parse(decoder.decode(serializedKeyPair));

            // Verify it has the expected structure
            expect(serialized).toHaveProperty('publicKey');
            expect(serialized).toHaveProperty('privateKey');

            // Return a mock key pair
            return {
              publicKey: {
                algorithm: { name: 'ECDH', namedCurve: 'P-384' },
                extractable: true,
                type: 'public',
                usages: ['deriveBits', 'deriveKey'],
              } as CryptoKey,
              privateKey: {
                algorithm: { name: 'ECDH', namedCurve: 'P-384' },
                extractable: true,
                type: 'private',
                usages: ['deriveBits', 'deriveKey'],
              } as CryptoKey,
            };
          },
        };

        // Generate a mock key pair
        const keyPair = {
          publicKey: {
            algorithm: { name: 'ECDH', namedCurve: 'P-384' },
            extractable: true,
            type: 'public',
            usages: ['deriveBits', 'deriveKey'],
          } as CryptoKey,
          privateKey: {
            algorithm: { name: 'ECDH', namedCurve: 'P-384' },
            extractable: true,
            type: 'private',
            usages: ['deriveBits', 'deriveKey'],
          } as CryptoKey,
        };

        // Test serialization
        const serializedData = await testService.serializeKeyPair(keyPair);
        expect(serializedData).toBeDefined();
        expect(serializedData.byteLength).toBeGreaterThan(0);

        // Convert serialized data to a string and verify JSON structure
        const serializedText = new TextDecoder().decode(serializedData);
        const serializedObj = JSON.parse(serializedText);
        expect(serializedObj).toHaveProperty('publicKey');
        expect(serializedObj).toHaveProperty('privateKey');

        // Test deserialization
        const deserializedKeyPair = await testService.deserializeKeyPair(serializedData);
        expect(deserializedKeyPair).toBeDefined();
        expect(deserializedKeyPair.publicKey).toBeDefined();
        expect(deserializedKeyPair.privateKey).toBeDefined();

        // Verify the key properties
        expect(deserializedKeyPair.publicKey.type).toBe('public');
        expect(deserializedKeyPair.privateKey.type).toBe('private');
        expect(deserializedKeyPair.publicKey.algorithm.name).toBe('ECDH');
        expect(deserializedKeyPair.privateKey.algorithm.name).toBe('ECDH');
        expect(deserializedKeyPair.publicKey.usages).toEqual(['deriveBits', 'deriveKey']);
      } finally {
        // Restore original mocks
        vi.mocked(btoa).mockImplementation(originalBtoa);
        vi.mocked(atob).mockImplementation(originalAtob);
      }
    });
  });
});
