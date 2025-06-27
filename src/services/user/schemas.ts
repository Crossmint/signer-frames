import { z } from 'zod';
import { encryptedUserKeySchema, sha256HashSchema } from '../api/api-schemas';

// Re-export commonly used schemas for backward compatibility
const encryptedMasterSecretSchema = encryptedUserKeySchema;
const userMasterSecretHashSchema = sha256HashSchema;

// User-specific schemas that extend the API schemas
export const hashedEncryptedMasterSecretSchema = z.object({
  deviceId: z.string(),
  encryptedUserKey: encryptedUserKeySchema,
  userKeyHash: sha256HashSchema,
});

// Type exports
type EncryptedMasterSecret = z.infer<typeof encryptedMasterSecretSchema>;
export type UserMasterSecretHash = z.infer<typeof userMasterSecretHashSchema>;
export type HashedEncryptedMasterSecret = z.infer<typeof hashedEncryptedMasterSecretSchema>;
