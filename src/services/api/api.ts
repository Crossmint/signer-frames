/**
 * CrossmintApiService - Handles interaction with Crossmint API
 */

import { calculateBackoff, defaultRetryConfig, shouldRetry } from './backoff';
import { CrossmintFrameService } from '../service';
import type { RetryConfig } from './backoff';
import { type AuthData, CrossmintRequest } from './request';
import { type Environment, getEnvironment } from './environment';
import {
  StartOnboardingInput,
  CompleteOnboardingInput,
  CompleteOnboardingOutput,
  GetEncryptedMasterSecretOutput,
  GetAttestationOutput,
  GetPublicKeyOutput,
  CrossmintApiServiceSchemas,
} from './api-schemas';
import { HPKEService } from '../encryption/hpke';

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

  constructor(private readonly hpke: HPKEService) {
    super();
    this.retryConfig = defaultRetryConfig;
  }

  async init() {}

  async startOnboarding(input: StartOnboardingInput, authData: AuthData) {
    CrossmintApiServiceSchemas.startOnboardingInputSchema.parse(input);
    const request = new CrossmintRequest({
      name: 'startOnboarding',
      inputSchema: CrossmintApiServiceSchemas.startOnboardingInputSchema,
      outputSchema: CrossmintApiServiceSchemas.startOnboardingOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      authData,
      endpoint: () => '/start-onboarding',
      method: 'POST',
      encrypted: false,
      encryptionService: this.hpke,
      getHeaders,
    });
    return request.execute({
      ...input,
    });
  }

  async completeOnboarding(
    input: CompleteOnboardingInput,
    authData: AuthData
  ): Promise<CompleteOnboardingOutput> {
    CrossmintApiServiceSchemas.completeOnboardingInputSchema.parse(input);
    const request = new CrossmintRequest({
      name: 'completeOnboarding',
      authData,
      inputSchema: CrossmintApiServiceSchemas.completeOnboardingInputSchema,
      outputSchema: CrossmintApiServiceSchemas.completeOnboardingOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      endpoint: () => '/complete-onboarding',
      method: 'POST',
      encrypted: true,
      encryptionService: this.hpke,
      getHeaders,
    });
    return request.execute(input);
  }

  async getAttestation(): Promise<GetAttestationOutput> {
    const request = new CrossmintRequest({
      name: 'getAttestation',
      inputSchema: CrossmintApiServiceSchemas.getAttestationInputSchema,
      outputSchema: CrossmintApiServiceSchemas.getAttestationOutputSchema,
      environment: getEnvironment(),
      endpoint: () => '/attestation',
      method: 'GET',
      encrypted: false,
      encryptionService: this.hpke,
      getHeaders,
    });
    return request.execute(undefined);
  }

  async getPublicKey(): Promise<GetPublicKeyOutput> {
    const request = new CrossmintRequest({
      name: 'getPublicKey',
      inputSchema: CrossmintApiServiceSchemas.getPublicKeyInputSchema,
      outputSchema: CrossmintApiServiceSchemas.getPublicKeyOutputSchema,
      environment: getEnvironment(),
      endpoint: () => '/attestation/public-key',
      method: 'GET',
      encrypted: false,
      encryptionService: this.hpke,
      getHeaders,
    });
    return request.execute(undefined);
  }

  async getEncryptedMasterSecret(
    deviceId: string,
    authData: AuthData
  ): Promise<GetEncryptedMasterSecretOutput> {
    CrossmintApiServiceSchemas.getEncryptedMasterSecretInputSchema.parse(undefined);
    const request = new CrossmintRequest({
      name: 'getEncryptedMasterSecret',
      inputSchema: CrossmintApiServiceSchemas.getEncryptedMasterSecretInputSchema,
      outputSchema: CrossmintApiServiceSchemas.getEncryptedMasterSecretOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      authData,
      endpoint: () => `/${deviceId}/encrypted-user-key`,
      method: 'GET',
      encrypted: false,
      encryptionService: this.hpke,
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
