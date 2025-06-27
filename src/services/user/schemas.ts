import { z } from 'zod';

export const encryptedMasterSecretSchema = z.object({
  bytes: z.string(),
  encoding: z.literal('base64'),
  encryptionPublicKey: z.string(),
});

export const userMasterSecretHashSchema = z.object({
  bytes: z.string(),
  encoding: z.literal('base64'),
  algorithm: z.literal('SHA-256'),
});

export const hashedEncryptedMasterSecretSchema = z.object({
  deviceId: z.string(),
  encryptedUserKey: encryptedMasterSecretSchema,
  userKeyHash: userMasterSecretHashSchema,
});

export type EncryptedMasterSecret = z.infer<typeof encryptedMasterSecretSchema>;
export type UserMasterSecretHash = z.infer<typeof userMasterSecretHashSchema>;
export type HashedEncryptedMasterSecret = z.infer<typeof hashedEncryptedMasterSecretSchema>;
