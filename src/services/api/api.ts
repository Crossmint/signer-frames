/**
 * CrossmintApiService - Handles interaction with Crossmint API
 */

import { calculateBackoff, defaultRetryConfig, shouldRetry } from './backoff';
import { CrossmintFrameService } from '../service';
import type { RetryConfig } from './backoff';
import { z } from 'zod';
import type { EncryptionService } from '../encryption';
import { type AuthData, CrossmintRequest } from './request';
import { type Environment, getEnvironment } from './environment';

function getHeaders(authData?: AuthData) {
  return {
    'Content-Type': 'application/json',
    ...(window?.crossmintAppId != null ? { 'x-app-identifier': window?.crossmintAppId } : {}),
    ...(authData != null
      ? {
          Authorization: `Bearer ${authData.jwt}`,
          'x-api-key': authData.apiKey,
        }
      : {}),
  };
}

// Export parseApiKey function to make it accessible for tests
export function parseApiKey(apiKey: string): {
  origin: 'server' | 'client';
  environment: Environment;
} {
  let origin: 'server' | 'client';
  switch (apiKey.slice(0, 2)) {
    case 'sk':
      origin = 'server';
      break;
    case 'ck':
      origin = 'client';
      break;
    default:
      throw new Error('Invalid API key. Invalid origin');
  }

  const apiKeyWithoutOrigin = apiKey.slice(3);
  const envs = ['development', 'staging', 'production'] as const;
  const environment = envs.find(env => apiKeyWithoutOrigin.startsWith(env));
  if (!environment) {
    throw new Error('Invalid API key. Invalid environment');
  }

  return {
    origin,
    environment,
  };
}

export class CrossmintApiService extends CrossmintFrameService {
  name = 'Crossmint API Service';
  log_prefix = '[CrossmintApiService]';
  private retryConfig: RetryConfig;

  constructor(private readonly encryptionService: EncryptionService) {
    super();
    this.retryConfig = defaultRetryConfig;
  }

  async init() {}

  // Zod schemas
  static startOnboardingInputSchema = z.object({
    authId: z.string(),
    deviceId: z.string(),
    encryptionContext: z.object({
      publicKey: z.string(),
    }),
  });
  static startOnboardingOutputSchema = z.object({});

  static encryptedMasterSecretSchema = z.object({
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
    signature: z.object({
      bytes: z.string(),
      encoding: z.literal('base64'),
      algorithm: z.literal('ECDSA'),
      signingPublicKey: z.string(),
    }),
  });

  static completeOnboardingInputSchema = z.object({
    publicKey: z.string(),
    onboardingAuthentication: z.object({
      otp: z.string(),
    }),
    deviceId: z.string(),
  });
  static completeOnboardingOutputSchema = CrossmintApiService.encryptedMasterSecretSchema;

  static getEncryptedMasterSecretInputSchema = z.undefined();
  static getEncryptedMasterSecretOutputSchema = CrossmintApiService.encryptedMasterSecretSchema;

  static getAttestationInputSchema = z.undefined();
  static getAttestationOutputSchema = z.object({
    publicKey: z.string(),
    quote: z.string(),
    event_log: z.string(),
    hash_algorithm: z.literal('sha512'),
    prefix: z.literal('app-data'),
  });

  static getPublicKeyInputSchema = z.undefined();
  static getPublicKeyOutputSchema = z.object({
    publicKey: z.string(),
  });

  async startOnboarding(
    input: z.infer<typeof CrossmintApiService.startOnboardingInputSchema>,
    authData: AuthData
  ) {
    CrossmintApiService.startOnboardingInputSchema.parse(input);
    const request = new CrossmintRequest({
      name: 'startOnboarding',
      inputSchema: CrossmintApiService.startOnboardingInputSchema,
      outputSchema: CrossmintApiService.startOnboardingOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      authData,
      endpoint: () => '/start-onboarding',
      method: 'POST',
      encrypted: false,
      encryptionService: this.encryptionService,
      getHeaders,
    });
    return request.execute({
      ...input,
    });
  }

  async completeOnboarding(
    input: z.infer<typeof CrossmintApiService.completeOnboardingInputSchema>,
    authData: AuthData
  ): Promise<z.infer<typeof CrossmintApiService.completeOnboardingOutputSchema>> {
    CrossmintApiService.completeOnboardingInputSchema.parse(input);
    const request = new CrossmintRequest({
      name: 'completeOnboarding',
      authData,
      inputSchema: CrossmintApiService.completeOnboardingInputSchema,
      outputSchema: CrossmintApiService.completeOnboardingOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      endpoint: () => '/complete-onboarding',
      method: 'POST',
      encrypted: true,
      encryptionService: this.encryptionService,
      getHeaders,
    });
    return request.execute(input);
  }

  async getAttestation(): Promise<z.infer<typeof CrossmintApiService.getAttestationOutputSchema>> {
    const request = new CrossmintRequest({
      name: 'getAttestation',
      inputSchema: CrossmintApiService.getAttestationInputSchema,
      outputSchema: CrossmintApiService.getAttestationOutputSchema,
      environment: getEnvironment(),
      endpoint: () => '/attestation',
      method: 'GET',
      encrypted: false,
      encryptionService: this.encryptionService,
      getHeaders,
    });
    return request.execute(undefined);
  }

  async getPublicKey(): Promise<z.infer<typeof CrossmintApiService.getPublicKeyOutputSchema>> {
    const request = new CrossmintRequest({
      name: 'getPublicKey',
      inputSchema: CrossmintApiService.getPublicKeyInputSchema,
      outputSchema: CrossmintApiService.getPublicKeyOutputSchema,
      environment: getEnvironment(),
      endpoint: () => '/attestation/public-key',
      method: 'GET',
      encrypted: false,
      encryptionService: this.encryptionService,
      getHeaders,
    });
    return request.execute(undefined);
  }

  async getEncryptedMasterSecret(
    deviceId: string,
    authData: AuthData
  ): Promise<z.infer<typeof CrossmintApiService.getEncryptedMasterSecretOutputSchema>> {
    CrossmintApiService.getEncryptedMasterSecretInputSchema.parse(undefined);
    const request = new CrossmintRequest({
      name: 'getEncryptedMasterSecret',
      inputSchema: CrossmintApiService.getEncryptedMasterSecretInputSchema,
      outputSchema: CrossmintApiService.getEncryptedMasterSecretOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      authData,
      endpoint: () => `/${deviceId}/encrypted-user-key`,
      method: 'GET',
      encrypted: false,
      encryptionService: this.encryptionService,
      getHeaders,
    });
    return request.execute(undefined);
  }

  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    retryCount = 0
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);

      // Check if we need to retry based on status code
      if (shouldRetry(response.status, retryCount, this.retryConfig)) {
        // Calculate delay with respect to Retry-After header if present (especially for 429)
        const retryAfterHeader = response.headers.get('Retry-After');
        const delayMs = calculateBackoff(
          retryCount,
          this.retryConfig,
          retryAfterHeader || undefined
        );

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Recursive retry with incremented retry count
        return this.fetchWithRetry(url, options, retryCount + 1);
      }

      return response;
    } catch (error) {
      // Handle network errors (will retry for network issues too)
      if (retryCount < this.retryConfig.maxRetries) {
        const delayMs = calculateBackoff(retryCount, this.retryConfig);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }

      // If max retries reached, throw the error
      throw error;
    }
  }
}
