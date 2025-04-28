/**
 * CrossmintApiService - Handles interaction with Crossmint API
 */

import { calculateBackoff, defaultRetryConfig, shouldRetry } from './backoff';
import type { XMIFService } from './service';
import type { RetryConfig } from './backoff';
import { z } from 'zod';
import type { EncryptionService } from './encryption';
import { CrossmintRequest } from './request';

export class CrossmintApiService implements XMIFService {
  name = 'Crossmint API Service';
  private retryConfig: RetryConfig;

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly apiKeyService = new ApiKeyService()
  ) {
    this.retryConfig = defaultRetryConfig;
  }

  async init() {}

  private getHeaders({ jwt, apiKey }: { jwt: string; apiKey: string }) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      'x-api-key': apiKey,
    };
  }

  // Zod schemas
  static createSignerInputSchema = z.object({
    deviceId: z.string(),
    authData: z.object({ jwt: z.string(), apiKey: z.string() }),
    data: z.object({ authId: z.string() }),
  });
  static createSignerOutputSchema = z.any(); // You may want to specify a stricter schema if you know the response shape

  static sendOtpInputSchema = z.object({
    deviceId: z.string(),
    authData: z.object({ jwt: z.string(), apiKey: z.string() }),
    data: z.object({ otp: z.string() }),
  });
  static sendOtpOutputSchema = z.object({
    shares: z.object({
      device: z.string(),
      auth: z.string(),
    }),
  });

  static getAuthShardInputSchema = z.object({
    deviceId: z.string(),
    authData: z.object({ jwt: z.string(), apiKey: z.string() }),
  });
  static getAuthShardOutputSchema = z.object({
    deviceId: z.string(),
    keyShare: z.string(),
  });

  async createSigner(input: z.infer<typeof CrossmintApiService.createSignerInputSchema>) {
    const { deviceId, authData } = CrossmintApiService.createSignerInputSchema.parse(input);
    const request = new CrossmintRequest({
      inputSchema: CrossmintApiService.createSignerInputSchema,
      outputSchema: CrossmintApiService.createSignerOutputSchema,
      endpoint: (_input, authData) =>
        `${this.apiKeyService.getBaseUrl(authData.apiKey)}/${deviceId}`,
      method: 'POST',
      encrypted: true,
      encryptionService: this.encryptionService,
      getHeaders: this.getHeaders.bind(this),
    });
    return request.execute(input, authData);
  }

  async sendOtp(
    input: z.infer<typeof CrossmintApiService.sendOtpInputSchema>
  ): Promise<z.infer<typeof CrossmintApiService.sendOtpOutputSchema>> {
    const { deviceId, authData } = CrossmintApiService.sendOtpInputSchema.parse(input);
    const request = new CrossmintRequest({
      inputSchema: CrossmintApiService.sendOtpInputSchema,
      outputSchema: CrossmintApiService.sendOtpOutputSchema,
      endpoint: (_input, authData) =>
        `${this.apiKeyService.getBaseUrl(authData.apiKey)}/${deviceId}/auth`,
      method: 'POST',
      encrypted: true,
      encryptionService: this.encryptionService,
      getHeaders: this.getHeaders.bind(this),
    });
    return request.execute(input, authData);
  }

  async getAuthShard(
    input: z.infer<typeof CrossmintApiService.getAuthShardInputSchema>
  ): Promise<z.infer<typeof CrossmintApiService.getAuthShardOutputSchema>> {
    const { deviceId, authData } = CrossmintApiService.getAuthShardInputSchema.parse(input);
    const request = new CrossmintRequest({
      inputSchema: CrossmintApiService.getAuthShardInputSchema,
      outputSchema: CrossmintApiService.getAuthShardOutputSchema,
      endpoint: (_input, authData) =>
        `${this.apiKeyService.getBaseUrl(authData.apiKey)}/${deviceId}/key-shares`,
      method: 'GET',
      encrypted: true,
      encryptionService: this.encryptionService,
      getHeaders: this.getHeaders.bind(this),
    });
    return request.execute(input, authData);
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

class ApiKeyService {
  getBaseUrl(apiKey: string) {
    const { environment } = this.parseApiKey(apiKey);
    const basePath = 'api/unstable/wallets/ncs';
    let baseUrl: string;
    switch (environment) {
      case 'development':
        baseUrl = 'http://localhost:3000';
        break;
      case 'staging':
        baseUrl = 'https://staging.crossmint.com';
        break;
      case 'production':
        baseUrl = 'https://crossmint.com';
        break;
      default:
        throw new Error('Invalid environment');
    }
    return `${baseUrl}/${basePath}`;
  }

  private parseApiKey(apiKey: string): {
    origin: 'server' | 'client';
    environment: 'development' | 'staging' | 'production';
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
}
