import { z } from 'zod';
import { encryptedMasterSecretSchema, sha256HashSchema } from '../api/api-schemas';

export const hashedEncryptedMasterSecretSchema = z.object({
  deviceId: z.string(),
  encryptedMasterSecret: encryptedMasterSecretSchema,
  masterSecretHash: sha256HashSchema,
});

export type HashedEncryptedMasterSecret = z.infer<typeof hashedEncryptedMasterSecretSchema>;
