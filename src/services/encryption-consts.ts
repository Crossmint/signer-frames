import { z } from 'zod';

export type EncryptionResult<T extends ArrayBuffer | string> = {
  ciphertext: T;
  encapsulatedKey: T;
  publicKey: T;
};
export type DecryptOptions = {
  validateTeeSender: boolean;
};

export const SerializedPublicKeySchema = z.object({
  raw: z.string(),
  algorithm: z.any(),
});
export type SerializedPublicKey = z.infer<typeof SerializedPublicKeySchema>;

export const SerializedPrivateKeySchema = z.object({
  raw: z.any(),
  usages: z.array(z.custom<KeyUsage>()),
  algorithm: z.any(),
});
export type SerializedPrivateKey = z.infer<typeof SerializedPrivateKeySchema>;

export const AES256_KEY_SPEC: AesKeyGenParams = {
  name: 'AES-GCM' as const,
  length: 256,
} as const;
export const ECDH_KEY_SPEC: EcKeyGenParams = {
  name: 'ECDH' as const,
  namedCurve: 'P-384' as const,
} as const;

export const STORAGE_KEYS = {
  PRIV_KEY: 'private-key',
  PUB_KEY: 'public-key',
} as const;
