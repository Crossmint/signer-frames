/**
 * CrossmintApiService - Handles interaction with Crossmint API
 */

import { defaultRetryConfig } from './backoff';
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
import { z } from 'zod';
import { parseApiKey } from './api-key';

/**
 * Configuration for creating a CrossmintRequest
 */
interface RequestConfig<
  TMethod extends 'GET' | 'POST' | 'PUT' | 'DELETE',
  TInput extends TMethod extends 'GET' | 'DELETE' ? undefined : Record<string, unknown>,
  TOutput extends Record<string, unknown>,
> {
  name: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  endpoint: string | ((input: TInput) => string);
  method: TMethod;
  encrypted: boolean;
  environment?: Environment;
  authData?: AuthData;
}

/**
 * Service for handling interactions with the Crossmint API
 * Provides methods for onboarding, attestation, and key management operations
 */
export class CrossmintApiService extends CrossmintFrameService {
  name = 'Crossmint API Service';
  log_prefix = '[CrossmintApiService]';
  private retryConfig: RetryConfig;

  constructor(private readonly hpke: HPKEService) {
    super();
    this.retryConfig = defaultRetryConfig;
  }

  async init() {}

  /**
   * Initiates the user onboarding process
   * @param input - Onboarding configuration including user details and preferences
   * @param authData - Authentication credentials (JWT and API key)
   * @returns Promise resolving to onboarding initialization response
   * @throws Error if input validation fails or API request fails
   */
  async startOnboarding(input: StartOnboardingInput, authData: AuthData) {
    CrossmintApiServiceSchemas.startOnboardingInputSchema.parse(input);

    const request = this.createRequest({
      name: 'startOnboarding',
      inputSchema: CrossmintApiServiceSchemas.startOnboardingInputSchema,
      outputSchema: CrossmintApiServiceSchemas.startOnboardingOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      authData,
      endpoint: '/start-onboarding',
      method: 'POST' as const,
      encrypted: false,
    });

    return request.execute({
      ...input,
    });
  }

  /**
   * Completes the user onboarding process with encrypted data
   * @param input - Completion data including encrypted user information
   * @param authData - Authentication credentials (JWT and API key)
   * @returns Promise resolving to onboarding completion response with user details
   * @throws Error if input validation fails, if the user is rate-limited or if the
   * OTP is invalid
   */
  async completeOnboarding(
    input: CompleteOnboardingInput,
    authData: AuthData
  ): Promise<CompleteOnboardingOutput> {
    CrossmintApiServiceSchemas.completeOnboardingInputSchema.parse(input);

    const request = this.createRequest({
      name: 'completeOnboarding',
      inputSchema: CrossmintApiServiceSchemas.completeOnboardingInputSchema,
      outputSchema: CrossmintApiServiceSchemas.completeOnboardingOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      authData,
      endpoint: '/complete-onboarding',
      method: 'POST' as const,
      encrypted: true,
    });

    return request.execute(input);
  }

  /**
   * Retrieves attestation data for secure communication
   * Used for establishing trusted communication channels and verifying server identity
   * @returns Promise resolving to attestation information
   * @throws Error if attestation retrieval fails
   */
  async getAttestation(): Promise<GetAttestationOutput> {
    const request = this.createRequest({
      name: 'getAttestation',
      inputSchema: CrossmintApiServiceSchemas.getAttestationInputSchema,
      outputSchema: CrossmintApiServiceSchemas.getAttestationOutputSchema,
      endpoint: '/attestation',
      method: 'GET' as const,
      encrypted: false,
    });

    return request.execute(undefined);
  }

  /**
   * Retrieves the server's public key for encryption operations
   * Used for establishing secure communication and encrypting sensitive data
   * @returns Promise resolving to public key information
   * @throws Error if public key retrieval fails
   */
  async getPublicKey(): Promise<GetPublicKeyOutput> {
    const request = this.createRequest({
      name: 'getPublicKey',
      inputSchema: CrossmintApiServiceSchemas.getPublicKeyInputSchema,
      outputSchema: CrossmintApiServiceSchemas.getPublicKeyOutputSchema,
      endpoint: '/attestation/public-key',
      method: 'GET' as const,
      encrypted: false,
    });

    return request.execute(undefined);
  }

  /**
   * Retrieves an encrypted master secret for a specific device
   * The master secret is encrypted with the device's public key and used for
   * local key derivation and cryptographic operations
   * @param deviceId - Unique identifier for the device
   * @param authData - Authentication credentials (JWT and API key)
   * @returns Promise resolving to encrypted master secret data
   * @throws Error if device ID validation fails or API request fails
   */
  async getEncryptedMasterSecret(
    deviceId: string,
    authData: AuthData
  ): Promise<GetEncryptedMasterSecretOutput> {
    CrossmintApiServiceSchemas.getEncryptedMasterSecretInputSchema.parse(undefined);

    const request = this.createRequest({
      name: 'getEncryptedMasterSecret',
      inputSchema: CrossmintApiServiceSchemas.getEncryptedMasterSecretInputSchema,
      outputSchema: CrossmintApiServiceSchemas.getEncryptedMasterSecretOutputSchema,
      environment: parseApiKey(authData.apiKey).environment,
      authData,
      endpoint: `/${deviceId}/encrypted-master-secret`,
      method: 'GET' as const,
      encrypted: false,
    });

    return request.execute(undefined);
  }

  /**
   * Creates a CrossmintRequest with common configuration
   * @param config - Request configuration options
   * @returns Configured CrossmintRequest instance
   */
  private createRequest<
    TMethod extends 'GET' | 'POST' | 'PUT' | 'DELETE',
    TInput extends TMethod extends 'GET' | 'DELETE' ? undefined : Record<string, unknown>,
    TOutput extends Record<string, unknown>,
  >(config: RequestConfig<TMethod, TInput, TOutput>): CrossmintRequest<TMethod, TInput, TOutput> {
    return new CrossmintRequest({
      name: config.name,
      inputSchema: config.inputSchema,
      outputSchema: config.outputSchema,
      environment: config.environment || getEnvironment(),
      authData: config.authData,
      endpoint:
        typeof config.endpoint === 'string' ? () => config.endpoint as string : config.endpoint,
      method: config.method,
      encrypted: config.encrypted,
      encryptionService: this.hpke,
      getHeaders: this.getHeaders,
    });
  }

  private getHeaders(authData?: AuthData) {
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
}
