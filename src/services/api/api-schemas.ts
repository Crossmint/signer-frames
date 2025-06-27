import { z } from 'zod';

// ================================
// Common/Shared Schemas
// ================================

export const base64BytesSchema = z.object({
  bytes: z.string(),
  encoding: z.literal('base64'),
});

export const sha256HashSchema = z.object({
  bytes: z.string(),
  encoding: z.literal('base64'),
  algorithm: z.literal('SHA-256'),
});

export const encryptionContextSchema = z.object({
  publicKey: z.string(),
});

export const encryptedUserKeySchema = z.object({
  bytes: z.string(),
  encoding: z.literal('base64'),
  encryptionPublicKey: z.string(),
});

export const onboardingAuthenticationSchema = z.object({
  otp: z.string(),
});

export const encryptedMasterSecretSchema = z.object({
  deviceId: z.string(),
  signerId: z.string(),
  encryptedUserKey: encryptedUserKeySchema,
  userKeyHash: sha256HashSchema,
});

// ================================
// Onboarding Schemas
// ================================

export const startOnboardingInputSchema = z.object({
  authId: z.string(),
  deviceId: z.string(),
  encryptionContext: encryptionContextSchema,
});

export const startOnboardingOutputSchema = z.object({});

export const completeOnboardingInputSchema = z.object({
  publicKey: z.string(),
  onboardingAuthentication: onboardingAuthenticationSchema,
  deviceId: z.string(),
});

export const completeOnboardingOutputSchema = encryptedMasterSecretSchema;

// ================================
// Master Secret Schemas
// ================================

export const getEncryptedMasterSecretInputSchema = z.undefined();
export const getEncryptedMasterSecretOutputSchema = encryptedMasterSecretSchema;

// ================================
// Attestation Schemas
// ================================

export const getAttestationInputSchema = z.undefined();
export const getAttestationOutputSchema = z.object({
  publicKey: z.string(),
  quote: z.string(),
  event_log: z.string(),
  hash_algorithm: z.literal('sha512'),
  prefix: z.literal('app-data'),
});

export const getPublicKeyInputSchema = z.undefined();
export const getPublicKeyOutputSchema = z.object({
  publicKey: z.string(),
});

// ================================
// Type Exports
// ================================

export type Base64Bytes = z.infer<typeof base64BytesSchema>;
export type SHA256Hash = z.infer<typeof sha256HashSchema>;
export type EncryptionContext = z.infer<typeof encryptionContextSchema>;
export type EncryptedUserKey = z.infer<typeof encryptedUserKeySchema>;
export type OnboardingAuthentication = z.infer<typeof onboardingAuthenticationSchema>;
export type EncryptedMasterSecret = z.infer<typeof encryptedMasterSecretSchema>;

export type StartOnboardingInput = z.infer<typeof startOnboardingInputSchema>;
export type StartOnboardingOutput = z.infer<typeof startOnboardingOutputSchema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingInputSchema>;
export type CompleteOnboardingOutput = z.infer<typeof completeOnboardingOutputSchema>;

export type GetEncryptedMasterSecretInput = z.infer<typeof getEncryptedMasterSecretInputSchema>;
export type GetEncryptedMasterSecretOutput = z.infer<typeof getEncryptedMasterSecretOutputSchema>;

export type GetAttestationInput = z.infer<typeof getAttestationInputSchema>;
export type GetAttestationOutput = z.infer<typeof getAttestationOutputSchema>;

export type GetPublicKeyInput = z.infer<typeof getPublicKeyInputSchema>;
export type GetPublicKeyOutput = z.infer<typeof getPublicKeyOutputSchema>;

// ================================
// Schema Collections
// ================================

export const CommonSchemas = {
  base64BytesSchema,
  sha256HashSchema,
  encryptionContextSchema,
  encryptedUserKeySchema,
  onboardingAuthenticationSchema,
  encryptedMasterSecretSchema,
} as const;

export const OnboardingSchemas = {
  input: {
    start: startOnboardingInputSchema,
    complete: completeOnboardingInputSchema,
  },
  output: {
    start: startOnboardingOutputSchema,
    complete: completeOnboardingOutputSchema,
  },
} as const;

export const MasterSecretSchemas = {
  input: {
    get: getEncryptedMasterSecretInputSchema,
  },
  output: {
    get: getEncryptedMasterSecretOutputSchema,
  },
} as const;

export const AttestationSchemas = {
  input: {
    attestation: getAttestationInputSchema,
    publicKey: getPublicKeyInputSchema,
  },
  output: {
    attestation: getAttestationOutputSchema,
    publicKey: getPublicKeyOutputSchema,
  },
} as const;

// ================================
// Legacy Export (for backward compatibility)
// ================================

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
} as const;

// ================================
// Unified Export
// ================================

export const ApiSchemas = {
  common: CommonSchemas,
  onboarding: OnboardingSchemas,
  masterSecret: MasterSecretSchemas,
  attestation: AttestationSchemas,
} as const;
