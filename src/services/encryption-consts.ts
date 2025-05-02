import { z } from 'zod';

export const SerializedKeySchema = z.object({
  raw: z.instanceof(ArrayBuffer),
  usages: z.array(z.custom<KeyUsage>()),
  algorithm: z.any(),
});
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
