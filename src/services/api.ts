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
    this.environment = 'staging'; // TODO: Make this configurable
  }

  async init() {}

  // Zod schemas
  static createSignerInputSchema = z.object({
    authId: z.string(),
    encryptionContext: z.object({
      publicKey: z.string(),
    }),
  });
  static createSignerOutputSchema = z.object({});

  static sendOtpInputSchema = z.object({ otp: z.string(), publicKey: z.string() });
  static sendOtpOutputSchema = z.object({
    shares: z.object({
      device: z.string(),
      auth: z.string(),
    }),
  });

  static getAuthShardInputSchema = z.undefined();
  static getAuthShardOutputSchema = z.object({
    deviceId: z.string(),
    keyShare: z.string(),
  });

  static getAttestationInputSchema = z.undefined();
  static getAttestationOutputSchema = z.object({
    publicKey: z.string(),
  });

  async createSigner(
    deviceId: string,
    input: z.infer<typeof CrossmintApiService.createSignerInputSchema>,
    authData: AuthData
  ) {
    CrossmintApiService.createSignerInputSchema.parse(input);
    const request = new CrossmintRequest({
      name: 'createSigner',
      inputSchema: CrossmintApiService.createSignerInputSchema,
      outputSchema: CrossmintApiService.createSignerOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      authData,
      endpoint: _input => `/${deviceId}`,
      method: 'POST',
      encrypted: false,
      encryptionService: this.encryptionService,
      getHeaders,
    });
    return request.execute(input);
  }

  async sendOtp(
    deviceId: string,
    input: z.infer<typeof CrossmintApiService.sendOtpInputSchema>,
    authData: AuthData
  ): Promise<z.infer<typeof CrossmintApiService.sendOtpOutputSchema>> {
    CrossmintApiService.sendOtpInputSchema.parse(input);
    const request = new CrossmintRequest({
      name: 'sendOtp',
      authData,
      inputSchema: CrossmintApiService.sendOtpInputSchema,
      outputSchema: CrossmintApiService.sendOtpOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      endpoint: _input => `/${deviceId}/auth`,
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
