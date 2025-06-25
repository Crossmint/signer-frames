/**
 * CrossmintApiService - Handles interaction with Crossmint API
 */

import { calculateBackoff, defaultRetryConfig, shouldRetry } from './backoff';
import { CrossmintFrameService } from '../service';
import type { RetryConfig } from './backoff';
import type { EncryptionService } from '../encryption';
import { type AuthData, CrossmintRequest } from './request';
import { type Environment, getEnvironment } from './environment';
import {
  completeOnboardingRequestSchema,
  type CompleteOnboardingRequest,
  type CompleteOnboardingResponse,
  completeOnboardingResponseSchema,
  getAuthShardRequestSchema,
  type GetAuthShardRequest,
  type GetAuthShardResponse,
  getAuthShardResponseSchema,
  getAttestationRequestSchema,
  type GetAttestationResponse,
  getAttestationResponseSchema,
  getPublicKeyRequestSchema,
  type GetPublicKeyResponse,
  getPublicKeyResponseSchema,
  startOnboardingRequestSchema,
  type StartOnboardingRequest,
  type StartOnboardingResponse,
  startOnboardingResponseSchema,
} from './schemas';

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

  async startOnboarding(
    input: StartOnboardingRequest,
    authData: AuthData
  ): Promise<StartOnboardingResponse> {
    startOnboardingRequestSchema.parse(input);
    const request = new CrossmintRequest({
      name: 'startOnboarding',
      inputSchema: startOnboardingRequestSchema,
      outputSchema: startOnboardingResponseSchema,
      environment: parseApiKey(authData.apiKey).environment,
      authData,
      endpoint: () => '/start-onboarding',
      method: 'POST',
      encrypted: false,
      encryptionService: this.encryptionService,
      getHeaders,
      ...input,
    });
    return request.execute({
      ...input,
    });
  }

  async completeOnboarding(
    input: CompleteOnboardingRequest,
    authData: AuthData
  ): Promise<CompleteOnboardingResponse> {
    completeOnboardingRequestSchema.parse(input);
    const request = new CrossmintRequest({
      name: 'completeOnboarding',
      authData,
      inputSchema: completeOnboardingRequestSchema,
      outputSchema: completeOnboardingResponseSchema,
      environment: parseApiKey(authData.apiKey).environment,
      endpoint: () => '/complete-onboarding',
      method: 'POST',
      encrypted: true,
      encryptionService: this.encryptionService,
      getHeaders,
    });
    return request.execute(input);
  }

  async getAttestation(): Promise<GetAttestationResponse> {
    const request = new CrossmintRequest({
      name: 'getAttestation',
      inputSchema: getAttestationRequestSchema,
      outputSchema: getAttestationResponseSchema,
      environment: getEnvironment(),
      endpoint: () => '/attestation',
      method: 'GET',
      encrypted: false,
      encryptionService: this.encryptionService,
      getHeaders,
    });
    return request.execute(undefined);
  }

  async getPublicKey(): Promise<GetPublicKeyResponse> {
    const request = new CrossmintRequest({
      name: 'getPublicKey',
      inputSchema: getPublicKeyRequestSchema,
      outputSchema: getPublicKeyResponseSchema,
      environment: getEnvironment(),
      endpoint: () => '/attestation/public-key',
      method: 'GET',
      encrypted: false,
      encryptionService: this.encryptionService,
      getHeaders,
    });
    return request.execute(undefined);
  }

  async getAuthShard(
    deviceId: string,
    input: GetAuthShardRequest,
    authData: AuthData
  ): Promise<GetAuthShardResponse> {
    getAuthShardRequestSchema.parse(input);
    const request = new CrossmintRequest({
      name: 'getAuthShard',
      inputSchema: getAuthShardRequestSchema,
      outputSchema: getAuthShardResponseSchema,
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
