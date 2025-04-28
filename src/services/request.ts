import { z } from 'zod';
import type { ZodSchema } from 'zod';
import type { EncryptionService } from './encryption';

type AuthData = {
  apiKey: string;
  jwt: string;
};

export interface CrossmintRequestOptions<I, O> {
  inputSchema: ZodSchema<I>;
  outputSchema: ZodSchema<O>;
  endpoint: (input: I, authData: { jwt: string; apiKey: string }) => string;
  method: string;
  encrypted?: boolean;
  encryptionService: EncryptionService;
  getHeaders: (authData: { jwt: string; apiKey: string }) => Record<string, string>;
  fetchImpl?: typeof fetch;
}

export class CrossmintRequest<
  I extends Record<string, unknown>,
  O extends Record<string, unknown>,
> {
  private inputSchema: ZodSchema<I>;
  private outputSchema: ZodSchema<O>;
  private method: string;
  private encrypted: boolean;
  private encryptionService: EncryptionService;
  private encryptedPayloadSchema = z.object({
    ciphertext: z.string(), // Check base64
    encappedKey: z.string(), // Check base64
    publicKey: z.string(), // Check base64
  });

  private endpoint: (input: I, authData: AuthData) => string;
  private getHeaders: (authData: AuthData) => Record<string, string>;
  private fetchImpl: typeof fetch;

  constructor(options: CrossmintRequestOptions<I, O>) {
    this.inputSchema = options.inputSchema;
    this.outputSchema = options.outputSchema;
    this.method = options.method;
    this.encrypted = options.encrypted || false;
    this.encryptionService = options.encryptionService;

    this.endpoint = options.endpoint;
    this.getHeaders = options.getHeaders;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async execute(input: I, authData: { jwt: string; apiKey: string }): Promise<O> {
    const parsedInput = this.inputSchema.parse(input);
    const body = JSON.stringify(await this.constructBody(parsedInput));

    let json = await this.fetchImpl(this.endpoint(parsedInput, authData), {
      method: this.method,
      body,
      headers: this.getHeaders(authData),
    }).then(response => response.json());

    return this.constructResponse(json);
  }

  private async constructBody(
    parsedInput: I
  ): Promise<I | z.infer<typeof this.encryptedPayloadSchema>> {
    if (this.encrypted) {
      if (!this.encryptionService) throw new Error('EncryptionService not provided');
      const encryptedPayload = this.encryptedPayloadSchema.parse(
        await this.encryptionService.encryptBase64(parsedInput)
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
      const parsedResponseData = this.encryptedPayloadSchema.parse(apiResponse);
      response = await this.encryptionService.decryptBase64(
        parsedResponseData.ciphertext,
        parsedResponseData.encappedKey
      );
    }
    return this.outputSchema.parse(response);
  }
}
