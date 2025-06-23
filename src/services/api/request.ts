import { z } from 'zod';
import type { ZodSchema } from 'zod';
import type { EncryptionService } from '../encryption';
import type { Environment } from './environment';

export type AuthData = {
  apiKey: string;
  jwt: string;
};

export class CrossmintHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
    public readonly responseBody?: unknown
  ) {
    super(`HTTP ${status}: ${statusText} at ${url}`);
    this.name = 'CrossmintHttpError';
  }
}

export interface CrossmintRequestOptions<I, O> {
  name?: string;
  inputSchema: ZodSchema<I>;
  outputSchema: ZodSchema<O>;
  environment: Environment;
  authData?: AuthData;
  endpoint: (input: I) => string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  encrypted?: boolean;
  encryptionService: EncryptionService;
  getHeaders: (authData?: AuthData) => Record<string, string>;
  fetchImpl?: typeof fetch;
}

const base64StringSchema = z
  .string()
  .regex(/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/);

export class CrossmintRequest<
  method extends 'GET' | 'POST' | 'PUT' | 'DELETE',
  I extends method extends 'GET' | 'DELETE' ? undefined : Record<string, unknown>,
  O extends Record<string, unknown>,
> {
  private name: string | undefined;
  private environment: Environment;
  private basePath = 'api/v1/signers';
  private authData: AuthData | undefined;
  private inputSchema: ZodSchema<I>;
  private outputSchema: ZodSchema<O>;
  private method: string;
  private encrypted: boolean;
  private encryptionService: EncryptionService;
  private encryptedPayloadSchema = z.object({
    ciphertext: base64StringSchema,
    encapsulatedKey: base64StringSchema,
    publicKey: base64StringSchema,
  });
  private log = (...args: unknown[]) => {
    console.log(`[Request${this.name ? `: ${this.name}` : ''}]`, ...args);
  };

  private endpoint: (input: I) => string;
  private getHeaders: (authData?: AuthData) => Record<string, string>;
  private fetchImpl: typeof fetch;

  constructor(options: CrossmintRequestOptions<I, O>) {
    this.name = options.name;
    this.inputSchema = options.inputSchema;
    this.outputSchema = options.outputSchema;
    this.method = options.method;
    this.encrypted = options.encrypted || false;
    this.encryptionService = options.encryptionService;
    this.authData = options.authData;
    this.environment = options.environment;
    this.endpoint = options.endpoint;
    this.getHeaders = options.getHeaders;
    this.fetchImpl = options.fetchImpl || fetch.bind(window);
  }

  async execute(input: I): Promise<O> {
    this.log(`Executing ${this.encrypted ? 'encrypted' : 'unencrypted'} ${this.method} request...`);
    this.log(`[TRACE] Parsing input ${JSON.stringify(input, null, 2)}...`);
    const parsedInput = this.inputSchema.parse(input);
    const bodyObject = parsedInput ? await this.constructBody(parsedInput) : undefined;
    this.log(`[TRACE] Body: ${JSON.stringify(bodyObject, null, 2)}...`);
    const body = bodyObject ? JSON.stringify(bodyObject) : undefined;
    const headers = this.getHeaders(this.authData);
    const url = new URL(
      this.basePath + this.endpoint(parsedInput),
      this.getUrlFromEnvironment(this.environment)
    );

    const response = await this.fetchImpl(url.toString(), {
      method: this.method,
      body,
      headers,
    });

    // Check if the response is successful (2xx status codes)
    if (!response.ok) {
      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch {
        // If response body is not JSON, ignore it
        responseBody = undefined;
      }

      throw new CrossmintHttpError(
        response.status,
        response.statusText,
        url.toString(),
        responseBody
      );
    }

    const json = await response.json();
    return this.constructResponse(json);
  }

  private async constructBody(
    parsedInput: I
  ): Promise<I | z.infer<typeof this.encryptedPayloadSchema>> {
    if (parsedInput == null) {
      throw new Error('Error parsing body: input is null');
    }
    if (this.encrypted) {
      this.log('Encrypting request. Encrypting body...');
      if (!this.encryptionService) throw new Error('EncryptionService not provided');
      const encryptedPayload = this.encryptedPayloadSchema.parse(
        await this.encryptionService.encryptBase64(parsedInput)
      );
      this.log(
        'Encryption successful! Encrypted body: ',
        JSON.stringify(encryptedPayload, null, 2)
      );
      return encryptedPayload;
    }
    return parsedInput;
  }

  private async constructResponse(
    apiResponse: O | z.infer<typeof this.encryptedPayloadSchema>
  ): Promise<O> {
    let response = apiResponse;
    if (this.encrypted) {
      this.log('Detected encrypted response. Decrypting...');
      this.log(`[TRACE] Parsing encrypted response ${JSON.stringify(apiResponse, null, 2)}...`);
      const parsedResponseData = this.encryptedPayloadSchema.parse(apiResponse);
      response = await this.encryptionService.decrypt(
        parsedResponseData.ciphertext,
        parsedResponseData.encapsulatedKey
      );
      this.log('Decryption successful!');
      this.log(`[TRACE] Decrypted response: ${JSON.stringify(response, null, 2)}`);
    }
    return this.outputSchema.parse(response);
  }

  private getUrlFromEnvironment(environment: Environment) {
    switch (environment) {
      case 'development':
        return 'http://localhost:3000/';
      case 'staging':
        return 'https://staging.crossmint.com/';
      case 'production':
        return 'https://crossmint.com/';
      default:
        throw new Error('Invalid environment');
    }
  }
}
