import { z } from 'zod';

export type EncryptionResult<T extends ArrayBuffer | string> = {
  ciphertext: T;
  encapsulatedKey: T;
  publicKey: T;
};
export type DecryptOptions = {
  validateTeeSender: boolean;
};

export const SerializedKeySchema = z.object({
  raw: z.string(),
  usages: z.array(z.custom<KeyUsage>()),
  algorithm: z.any(),
});
export type SerializedKey = z.infer<typeof SerializedKeySchema>;

export const AES256_KEY_SPEC: AesKeyGenParams = {
  name: 'AES-GCM' as const,
  length: 256,
} as const;
export const ECDH_KEY_SPEC: EcKeyGenParams = {
  name: 'ECDH' as const,
  namedCurve: 'P-384' as const,
} as const;

export const STORAGE_KEYS = {
  KEY_PAIR: 'ephemeral-key-pair',
} as const;
