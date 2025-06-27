import { z } from 'zod';

// ================================
// Common/Shared Schemas
// ================================

const base64BytesSchema = z.object({
  bytes: z.string(),
  encoding: z.literal('base64'),
});

export const sha256HashSchema = z.object({
  bytes: z.string(),
  encoding: z.literal('base64'),
  algorithm: z.literal('SHA-256'),
});

const encryptionContextSchema = z.object({
  publicKey: z.string(),
});

export const encryptedUserKeySchema = z.object({
  bytes: z.string(),
  encoding: z.literal('base64'),
  encryptionPublicKey: z.string(),
});

const onboardingAuthenticationSchema = z.object({
  otp: z.string(),
});

const encryptedMasterSecretSchema = z.object({
  deviceId: z.string(),
  signerId: z.string(),
  encryptedUserKey: encryptedUserKeySchema,
  userKeyHash: sha256HashSchema,
});

// ================================
// Onboarding Schemas
// ================================

const startOnboardingInputSchema = z.object({
  authId: z.string(),
  deviceId: z.string(),
  encryptionContext: encryptionContextSchema,
});

const startOnboardingOutputSchema = z.object({});

const completeOnboardingInputSchema = z.object({
  publicKey: z.string(),
  onboardingAuthentication: onboardingAuthenticationSchema,
  deviceId: z.string(),
});

const completeOnboardingOutputSchema = encryptedMasterSecretSchema;

// ================================
// Master Secret Schemas
// ================================

const getEncryptedMasterSecretInputSchema = z.undefined();
const getEncryptedMasterSecretOutputSchema = encryptedMasterSecretSchema;

// ================================
// Attestation Schemas
// ================================

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

// ================================
// Type Exports
// ================================

type Base64Bytes = z.infer<typeof base64BytesSchema>;
type SHA256Hash = z.infer<typeof sha256HashSchema>;
type EncryptionContext = z.infer<typeof encryptionContextSchema>;
type EncryptedUserKey = z.infer<typeof encryptedUserKeySchema>;
type OnboardingAuthentication = z.infer<typeof onboardingAuthenticationSchema>;
type EncryptedMasterSecret = z.infer<typeof encryptedMasterSecretSchema>;

export type StartOnboardingInput = z.infer<typeof startOnboardingInputSchema>;
type StartOnboardingOutput = z.infer<typeof startOnboardingOutputSchema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingInputSchema>;
export type CompleteOnboardingOutput = z.infer<typeof completeOnboardingOutputSchema>;

type GetEncryptedMasterSecretInput = z.infer<typeof getEncryptedMasterSecretInputSchema>;
export type GetEncryptedMasterSecretOutput = z.infer<typeof getEncryptedMasterSecretOutputSchema>;

type GetAttestationInput = z.infer<typeof getAttestationInputSchema>;
export type GetAttestationOutput = z.infer<typeof getAttestationOutputSchema>;

type GetPublicKeyInput = z.infer<typeof getPublicKeyInputSchema>;
export type GetPublicKeyOutput = z.infer<typeof getPublicKeyOutputSchema>;

// ================================
// Schema Collections
// ================================

const CommonSchemas = {
  base64BytesSchema,
  sha256HashSchema,
  encryptionContextSchema,
  encryptedUserKeySchema,
  onboardingAuthenticationSchema,
  encryptedMasterSecretSchema,
} as const;

const OnboardingSchemas = {
  input: {
    start: startOnboardingInputSchema,
    complete: completeOnboardingInputSchema,
  },
  output: {
    start: startOnboardingOutputSchema,
    complete: completeOnboardingOutputSchema,
  },
} as const;

const MasterSecretSchemas = {
  input: {
    get: getEncryptedMasterSecretInputSchema,
  },
  output: {
    get: getEncryptedMasterSecretOutputSchema,
  },
} as const;

const AttestationSchemas = {
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

const ApiSchemas = {
  common: CommonSchemas,
  onboarding: OnboardingSchemas,
  masterSecret: MasterSecretSchemas,
  attestation: AttestationSchemas,
} as const;
