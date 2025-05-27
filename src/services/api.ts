/**
 * CrossmintApiService - Handles interaction with Crossmint API
 */

import { calculateBackoff, defaultRetryConfig, shouldRetry } from './backoff';
import { XMIFService } from './service';
import type { RetryConfig } from './backoff';
import { z } from 'zod';
import type { EncryptionService } from './encryption';
import { type AuthData, CrossmintRequest } from './request';

export type Environment = 'development' | 'staging' | 'production';
const DEFAULT_ENVIRONMENT: Environment = 'staging';
const isEnvironment = (env: unknown): env is Environment => {
  return ['development', 'staging', 'production'].includes(env as Environment);
};

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

export class CrossmintApiService extends XMIFService {
  name = 'Crossmint API Service';
  log_prefix = '[CrossmintApiService]';
  private retryConfig: RetryConfig;
  private readonly environment: Environment;

  constructor(private readonly encryptionService: EncryptionService) {
    super();
    this.retryConfig = defaultRetryConfig;

    const urlParams = new URLSearchParams(window.location.search);
    const envParam = urlParams.get('environment');
    if (isEnvironment(envParam)) {
      this.log(`Environment: ${envParam}`);
      this.environment = envParam;
    } else {
      this.log(`Using default environment: ${DEFAULT_ENVIRONMENT}`);
      this.environment = DEFAULT_ENVIRONMENT;
    }
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

  static completeOnboardingInputSchema = z.object({
    publicKey: z.string(),
    onboardingAuthentication: z.object({
      otp: z.string(),
    }),
    deviceId: z.string(),
  });
  static completeOnboardingOutputSchema = z.object({
    shares: z.object({
      device: z.string(),
      auth: z.string(),
    }),
  });

  static getAuthShardInputSchema = z.undefined();
  static getAuthShardOutputSchema = z.object({
    deviceId: z.string(),
    keyShare: z.string(),
    deviceKeyShareHash: z.string(),
  });

  static getAttestationInputSchema = z.undefined();
  static getAttestationOutputSchema = z.object({
    publicKey: z.string(),
    quote: z.string(),
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
      environment: this.environment,
      endpoint: () => '/attestation',
      method: 'GET',
      encrypted: false,
      encryptionService: this.encryptionService,
      getHeaders,
    });
    return request.execute(undefined);
  }

  async getAuthShard(
    deviceId: string,
    input: z.infer<typeof CrossmintApiService.getAuthShardInputSchema>,
    authData: AuthData
  ): Promise<z.infer<typeof CrossmintApiService.getAuthShardOutputSchema>> {
    CrossmintApiService.getAuthShardInputSchema.parse(input);
    const request = new CrossmintRequest({
      name: 'getAuthShard',
      inputSchema: CrossmintApiService.getAuthShardInputSchema,
      outputSchema: CrossmintApiService.getAuthShardOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      authData,
      endpoint: _input => `/${deviceId}/key-shares`,
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
