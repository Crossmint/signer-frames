import { z } from 'zod';

const startOnboardingInputSchema = z.object({
  authId: z.string(),
  deviceId: z.string(),
  encryptionContext: z.object({
    publicKey: z.string(),
  }),
});
const startOnboardingOutputSchema = z.object({});

const encryptedMasterSecretSchema = z.object({
  deviceId: z.string(),
  signerId: z.string(),
  encryptedUserKey: z.object({
    bytes: z.string(),
    encoding: z.literal('base64'),
    encryptionPublicKey: z.string(),
  }),
  userKeyHash: z.object({
    bytes: z.string(),
    encoding: z.literal('base64'),
    algorithm: z.literal('SHA-256'),
  }),
});

const completeOnboardingInputSchema = z.object({
  publicKey: z.string(),
  onboardingAuthentication: z.object({
    otp: z.string(),
  }),
  deviceId: z.string(),
});
const completeOnboardingOutputSchema = encryptedMasterSecretSchema;

const getEncryptedMasterSecretInputSchema = z.undefined();
const getEncryptedMasterSecretOutputSchema = encryptedMasterSecretSchema;

const getAttestationInputSchema = z.undefined();
const getAttestationOutputSchema = z.object({
  publicKey: z.string(),
  quote: z.string(),
  event_log: z.string(),
  hash_algorithm: z.literal('sha512'),
  prefix: z.literal('app-data'),
});

const getPublicKeyInputSchema = z.undefined();
const getPublicKeyOutputSchema = z.object({
  publicKey: z.string(),
});

export type StartOnboardingInputSchema = z.infer<typeof startOnboardingInputSchema>;
export type StartOnboardingOutputSchema = z.infer<typeof startOnboardingOutputSchema>;
export type CompleteOnboardingInputSchema = z.infer<typeof completeOnboardingInputSchema>;
export type CompleteOnboardingOutputSchema = z.infer<typeof completeOnboardingOutputSchema>;
export type GetEncryptedMasterSecretInputSchema = z.infer<
  typeof getEncryptedMasterSecretInputSchema
>;
export type GetEncryptedMasterSecretOutputSchema = z.infer<
  typeof getEncryptedMasterSecretOutputSchema
>;
export type GetAttestationInputSchema = z.infer<typeof getAttestationInputSchema>;
export type GetAttestationOutputSchema = z.infer<typeof getAttestationOutputSchema>;
export type GetPublicKeyInputSchema = z.infer<typeof getPublicKeyInputSchema>;
export type GetPublicKeyOutputSchema = z.infer<typeof getPublicKeyOutputSchema>;

export const CrossmintApiServiceSchemas = {
  startOnboardingInputSchema,
  startOnboardingOutputSchema,
  completeOnboardingInputSchema,
  completeOnboardingOutputSchema,
  getEncryptedMasterSecretInputSchema,
  getEncryptedMasterSecretOutputSchema,
  getAttestationInputSchema,
  getAttestationOutputSchema,
  getPublicKeyInputSchema,
  getPublicKeyOutputSchema,
};
