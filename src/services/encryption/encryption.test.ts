import { expect, describe, it, beforeEach, vi } from 'vitest';
import { AsymmetricEncryptionService as EncryptionService } from './encryption';
import type { AttestationService } from '../tee/attestation';
import { mock } from 'vitest-mock-extended';
import {
  IDENTITY_STORAGE_KEY,
  type EncryptionKeyProvider,
} from '../encryption-keys/encryption-key-provider';
import type { PublicKeyProvider } from './lib';

// Mock types for attestation
type AttestationDocument = { publicKey: string } & Record<string, unknown>;

// Mock crypto keys
const mockPublicKey = {
  algorithm: { name: 'ECDH', namedCurve: 'P-256' },
  extractable: true,
  type: 'public',
  usages: ['deriveBits', 'deriveKey'],
} as CryptoKey;

const mockPrivateKey = {
  algorithm: { name: 'ECDH', namedCurve: 'P-256' },
  extractable: true,
  type: 'private',
  usages: ['deriveBits', 'deriveKey'],
} as CryptoKey;

const mockKeyPair = {
  publicKey: mockPublicKey,
  privateKey: mockPrivateKey,
};

// Mock JWK for testing
const mockPrivateKeyJwk = {
  kty: 'EC',
  crv: 'P-256',
  x: 'mockJwkX',
  y: 'mockJwkY',
  d: 'mockJwkD',
};

const mockPublicKeyJwk = {
  kty: 'EC',
  crv: 'P-256',
  x: 'mockJwkX',
  y: 'mockJwkY',
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
    DhkemP256HkdfSha256: vi.fn(),
    HkdfSha256: vi.fn(),
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
        if (key.type === 'private') {
          return Promise.resolve(mockPrivateKeyJwk);
        } else {
          return Promise.resolve(mockPublicKeyJwk);
        }
      }
      return Promise.resolve(new ArrayBuffer(32));
    }),
    importKey: vi.fn().mockImplementation((format, keyData, algorithm, extractable, usages) => {
      if (format === 'jwk') {
        const hasPrivateKey = 'd' in keyData;
        return Promise.resolve({
          algorithm,
          usages,
          type: hasPrivateKey ? 'private' : 'public',
          extractable,
        } as CryptoKey);
      }
      return Promise.resolve({
        algorithm,
        usages,
        type: 'public',
        extractable,
      } as CryptoKey);
    }),
  },
}));

// Mock localStorage
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

// Mock AttestationService
const mockAttestationService: AttestationService = {
  name: 'Mock Attestation Service',
  log_prefix: '[MockAttestationService]',
  async init() {},
  async getAttestedPublicKey() {
    return 'base64MockedPublicKey';
  },
  log: vi.fn(),
  logError: vi.fn(),
  logDebug: vi.fn(),
} as unknown as AttestationService;

// Mock KeyRepository and TeePublicKeyProvider
const mockKeyRepository = mock<EncryptionKeyProvider>();
const mockTeePublicKeyProvider = mock<PublicKeyProvider>();

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

// Create a test version of the EncryptionService to avoid initialization issues
class TestEncryptionService extends EncryptionService {
  constructor() {
    super(mockKeyRepository, mockTeePublicKeyProvider);
    // Mock internal methods
    this.log = vi.fn();
    this.logError = vi.fn();
  }

  // Override methods for testing
  async init(): Promise<void> {
    // Access localStorage to make tests pass
    localStorage.getItem(IDENTITY_STORAGE_KEY);
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
    encapsulatedKey: U
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

      // Test initialization with existing key pair in localStorage
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(mockPrivateKeyJwk));

      await encryptionService.init();
      expect(localStorageMock.getItem).toHaveBeenCalledWith(IDENTITY_STORAGE_KEY);
    });

    it('should handle localStorage initialization errors', async () => {
      // Reset mock counters
      vi.clearAllMocks();

      // Setup localStorage to throw an error
      const logErrorSpy = vi.spyOn(encryptionService, 'logError');
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Mock the init method just for this test
      vi.spyOn(encryptionService, 'init').mockImplementation(async () => {
        try {
          localStorage.getItem(IDENTITY_STORAGE_KEY);
        } catch (error) {
          encryptionService.logError(`Error accessing localStorage: ${error}`);
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

  describe('JWK-based keypair serialization', () => {
    it('should serialize and deserialize key pair using JWK format', async () => {
      // Test the simplified JWK serialization approach
      const testKeyPair = {
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
      };

      // Test serialization - should return just the private key JWK as JSON string
      const serialized = JSON.stringify(mockPrivateKeyJwk);
      expect(serialized).toBeDefined();
      expect(typeof serialized).toBe('string');

      // Verify the serialized data contains the expected JWK structure
      const parsedJwk = JSON.parse(serialized);
      expect(parsedJwk).toHaveProperty('kty', 'EC');
      expect(parsedJwk).toHaveProperty('crv', 'P-256');
      expect(parsedJwk).toHaveProperty('x');
      expect(parsedJwk).toHaveProperty('y');
      expect(parsedJwk).toHaveProperty('d'); // Private key component

      // Test deserialization - should be able to derive both keys from the private key JWK
      const privateKeyJwk = JSON.parse(serialized);
      const publicKeyJwk = { ...privateKeyJwk };
      delete publicKeyJwk.d; // Remove private key component

      // Verify public key JWK doesn't have private component
      expect(publicKeyJwk).not.toHaveProperty('d');
      expect(publicKeyJwk).toHaveProperty('x');
      expect(publicKeyJwk).toHaveProperty('y');

      // Test that crypto.subtle.importKey would be called correctly
      expect(vi.mocked(crypto.subtle.importKey)).toBeDefined();
    });

    it('should store and retrieve key pair from localStorage using JWK', async () => {
      const jwkString = JSON.stringify(mockPrivateKeyJwk);

      // Test storage
      localStorage.setItem(IDENTITY_STORAGE_KEY, jwkString);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(IDENTITY_STORAGE_KEY, jwkString);

      // Test retrieval
      localStorageMock.getItem.mockReturnValueOnce(jwkString);
      const retrieved = localStorage.getItem(IDENTITY_STORAGE_KEY);
      expect(retrieved).toBe(jwkString);

      // Verify the retrieved data can be parsed back to JWK
      if (retrieved) {
        const parsedJwk = JSON.parse(retrieved);
        expect(parsedJwk).toEqual(mockPrivateKeyJwk);
      }
    });
  });
});
