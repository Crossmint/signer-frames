import { vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import type { CrossmintFrameServices } from '../services';
import type { CrossmintApiService } from '../services/api';
import type { ShardingService } from '../services/user/sharding';
import type { AttestationService } from '../services/tee/attestation';
import type { Ed25519Service } from '../services/crypto/algorithms/ed25519';
import type { EventsService } from '../services/communications/events';
import type { EncryptionService } from '../services/encryption';
import type { FPEService } from '../services/encryption/fpe';
import type { Secp256k1Service } from '../services/crypto/algorithms/secp256k1';
import type { CryptoKeyService } from '../services/crypto/crypto-key';
import type { DeviceService } from '../services/user/device';
import { IndexedDBAdapter } from '../services/storage';
import { EncryptionKeyProvider } from '../services/encryption-keys/encryption-key-provider';
import { TEEKeyProvider } from '../services/encryption-keys/tee-key-provider';
/**
 * Creates mock services for testing with proper typing
 */
export function createMockServices(): MockProxy<CrossmintFrameServices> & {
  api: MockProxy<CrossmintApiService>;
  sharding: MockProxy<ShardingService>;
  attestation: MockProxy<AttestationService>;
  ed25519: MockProxy<Ed25519Service>;
  events: MockProxy<EventsService>;
  encrypt: MockProxy<EncryptionService>;
  fpe: MockProxy<FPEService>;
  secp256k1: MockProxy<Secp256k1Service>;
  cryptoKey: MockProxy<CryptoKeyService>;
  device: MockProxy<DeviceService>;
  teeKey: MockProxy<TEEKeyProvider>;
  keyRepository: MockProxy<EncryptionKeyProvider>;
} {
  return {
    api: mock<CrossmintApiService>(),
    sharding: mock<ShardingService>(),
    attestation: mock<AttestationService>(),
    ed25519: mock<Ed25519Service>(),
    events: mock<EventsService>(),
    encrypt: mock<EncryptionService>(),
    fpe: mock<FPEService>(),
    secp256k1: mock<Secp256k1Service>(),
    cryptoKey: mock<CryptoKeyService>(),
    device: mock<DeviceService>(),
    storage: mock<IndexedDBAdapter>(),
    teeKey: mock<TEEKeyProvider>(),
    keyRepository: mock<EncryptionKeyProvider>(),
  };
}

/**
 * Creates a mock fetch response
 */
export function createMockResponse<T>(
  data: T,
  options: { status?: number; statusText?: string; headers?: Record<string, string> } = {}
): Response {
  const { status = 200, statusText = 'OK', headers = {} } = options;

  const mockResponse = {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    blob: vi.fn().mockRejectedValue(new Error('Not implemented')),
    formData: vi.fn().mockRejectedValue(new Error('Not implemented')),
    arrayBuffer: vi.fn().mockRejectedValue(new Error('Not implemented')),
    bodyUsed: false,
    body: null,
    redirected: false,
    type: 'basic',
    url: 'https://mock-url.com',
    clone: () => mockResponse,
    redirect: () => new Response(),
  };

  return mockResponse as unknown as Response;
}

/**
 * Mock console methods to prevent test noise
 */
export function mockConsole(): void {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
}

/**
 * Utility for mocking window.crypto functionality
 */
export function mockCrypto(): void {
  const mockRandomValues = (buffer: Uint8Array) => {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  };

  vi.stubGlobal('crypto', {
    subtle: {
      digest: vi.fn().mockImplementation(async () => {
        return new Uint8Array(32).fill(1).buffer;
      }),
      generateKey: vi.fn().mockResolvedValue({}),
      exportKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(1).buffer),
      importKey: vi.fn().mockResolvedValue({}),
      encrypt: vi.fn().mockResolvedValue(new Uint8Array(32).fill(1).buffer),
      decrypt: vi.fn().mockResolvedValue(new Uint8Array(32).fill(1).buffer),
    },
    getRandomValues: mockRandomValues,
  });
}
