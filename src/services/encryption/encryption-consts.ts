import { CipherSuite, Aes256Gcm, DhkemP256HkdfSha256, HkdfSha256 } from '@hpke/core';

export type EncryptionResult<T extends ArrayBuffer | string> = {
  ciphertext: T;
  encapsulatedKey: T;
};

export const AES256_KEY_SPEC: AesKeyGenParams = {
  name: 'AES-GCM' as const,
  length: 256,
} as const;

export const ECDH_KEY_SPEC: EcKeyGenParams = {
  name: 'ECDH' as const,
  namedCurve: 'P-256' as const,
} as const;

export const IDENTITY_STORAGE_KEY = 'encryption-key-pair';
export const IDENTITY_KEY_PERMISSIONS: KeyUsage[] = ['deriveBits', 'deriveKey'];

export const createHpkeSuite = () => {
  return new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Aes256Gcm(),
  });
};
