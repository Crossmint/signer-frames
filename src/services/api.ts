/**
 * CrossmintApiService - Handles interaction with Crossmint API
 */

import { calculateBackoff, defaultRetryConfig, shouldRetry, type RetryConfig } from './backoff';
import type { XMIFService } from './service';

export class CrossmintApiService implements XMIFService {
  name = 'Crossmint API Service';
  private retryConfig: RetryConfig;

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...defaultRetryConfig, ...retryConfig };
  }

  async init() {}

  public getBaseUrl(apiKey: string) {
    const { environment } = parseApiKey(apiKey);
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

  private getHeaders({ jwt, apiKey }: { jwt: string; apiKey: string }): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      'x-api-key': apiKey,
    };

    // Add x-app-identifier only if running in a browser-like environment
    // and the crossmintAppId is available on the window object.
    if (typeof window !== 'undefined') {
      const crossmintId = (window as WindowWithCrossmintAppId).crossmintAppId;
      if (crossmintId != null) {
        headers['x-app-identifier'] = crossmintId;
      }
    }

    return headers;
  }

  /**
   * Makes a fetch request with retry capability
   */
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

  async createSigner(
    deviceId: string,
    authData: { jwt: string; apiKey: string },
    data: {
      authId: string;
    }
  ) {
    const response = await this.fetchWithRetry(`${this.getBaseUrl(authData.apiKey)}/${deviceId}`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: this.getHeaders(authData),
    });

    return response;
  }

  async sendOtp(
    deviceId: string,
    authData: { jwt: string; apiKey: string },
    data: {
      otp: string;
    }
  ): Promise<{
    shares: {
      device: string;
      auth: string;
    };
  }> {
    const response = await this.fetchWithRetry(
      `${this.getBaseUrl(authData.apiKey)}/${deviceId}/auth`,
      {
        method: 'POST',
        body: JSON.stringify(data),
        headers: this.getHeaders(authData),
      }
    );

    return response.json();
  }

  async getAuthShard(
    deviceId: string,
    authData: { jwt: string; apiKey: string }
  ): Promise<{
    deviceId: string;
    keyShare: string;
  }> {
    const response = await this.fetchWithRetry(
      `${this.getBaseUrl(authData.apiKey)}/${deviceId}/key-shares`,
      {
        headers: this.getHeaders(authData),
      }
    );

    return response.json();
  }
}

export function parseApiKey(apiKey: string): {
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

interface WindowWithCrossmintAppId extends Window {
  crossmintAppId?: string;
}
