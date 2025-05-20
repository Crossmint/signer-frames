import type {
  SignerIFrameEventName,
  SignerInputEvent,
  SignerOutputEvent,
} from '@crossmint/client-signers';
import bs58 from 'bs58';
import type { XMIFServices } from '.';
import { measureFunctionTime } from './utils';
import { XMIFCodedError } from './error';

const DEFAULT_TIMEOUT_MS = 30_000;

export abstract class EventHandler<
  EventName extends SignerIFrameEventName = SignerIFrameEventName,
> {
  abstract event: `request:${EventName}`;
  abstract responseEvent: `response:${EventName}`;

  abstract handler(
    payload: SignerInputEvent<EventName>
  ): Promise<Omit<SignerOutputEvent<EventName>, 'status'>>;

  constructor(protected readonly services: XMIFServices) {}

  async callback(payload: SignerInputEvent<EventName>): Promise<SignerOutputEvent<EventName>> {
    try {
      const result = await measureFunctionTime(`[${this.event} handler]`, async () =>
        this.handler(payload)
      );
      return {
        status: 'success',
        ...result,
      };
    } catch (error: unknown) {
      const errorResponse = {
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...(error instanceof XMIFCodedError && { code: error.code }),
      };

      console.error(`[${this.event} handler] Error: ${error}`);
      return errorResponse;
    }
  }

  options = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

export class CreateSignerEventHandler extends EventHandler<'create-signer'> {
  event = 'request:create-signer' as const;
  responseEvent = 'response:create-signer' as const;

  async handler(payload: SignerInputEvent<'create-signer'>) {
    if (this.services.sharding.status() === 'ready') {
      const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);
      const publicKey = await this.services.ed25519.getPublicKey(masterSecret);
      return {
        address: publicKey,
      };
    }

    await this.services.api.createSigner(
      this.services.sharding.getDeviceId(),
      {
        ...payload.data,
        encryptionContext: {
          publicKey: await this.services.encrypt.getPublicKey(),
        },
      },
      payload.authData
    );

    return {};
  }
}

export class SendOtpEventHandler extends EventHandler<'send-otp'> {
  event = 'request:send-otp' as const;
  responseEvent = 'response:send-otp' as const;

  async handler(payload: SignerInputEvent<'send-otp'>) {
    const deviceId = this.services.sharding.getDeviceId();
    console.log(
      `[DEBUG, ${this.event} handler] Received encrypted OTP: ${payload.data.encryptedOtp}. Decrypting`
    );
    const decryptedOtp = (
      await this.services.fpe.decrypt(payload.data.encryptedOtp.split('').map(Number))
    ).join('');
    const senderPublicKey = await this.services.encrypt.getPublicKey();

    const response = await this.services.api.sendOtp(
      deviceId,
      {
        otp: decryptedOtp,
        publicKey: senderPublicKey,
      },
      payload.authData
    );

    this.services.sharding.storeDeviceShare(response.shares.device);
    const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);
    const secretKey = await this.services.ed25519.secretKeyFromSeed(masterSecret);
    const publicKey = await this.services.ed25519.getPublicKey(secretKey);
    return {
      address: publicKey,
    };
  }
}

export class GetPublicKeyEventHandler extends EventHandler<'get-public-key'> {
  event = 'request:get-public-key' as const;
  responseEvent = 'response:get-public-key' as const;

  async handler(payload: SignerInputEvent<'get-public-key'>) {
    const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);
    const secretKey = await this.services.ed25519.secretKeyFromSeed(masterSecret);
    const publicKey = await this.services.ed25519.getPublicKey(secretKey);
    return {
      publicKey,
    };
  }
}

export class GetStatusEventHandler extends EventHandler<'get-status'> {
  event = 'request:get-status' as const;
  responseEvent = 'response:get-status' as const;

  async handler() {
    return { signerStatus: this.services.sharding.status() };
  }
}

export class SignEventHandler extends EventHandler<'sign'> {
  event = 'request:sign' as const;
  responseEvent = 'response:sign' as const;

  async handler(payload: SignerInputEvent<'sign'>) {
    const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);
    const { keyType, bytes, encoding } = payload.data;
    switch (keyType) {
      case 'ed25519': {
        const message = decodeBytes(bytes, encoding);
        const secretKey = await this.services.ed25519.secretKeyFromSeed(masterSecret);
        return {
          signature: bs58.encode(await this.services.ed25519.sign(message, secretKey)),
          publicKey: await this.services.ed25519.getPublicKey(secretKey),
        };
      }
      default:
        throw new Error(`Key type not implemented: ${keyType}`);
    }
  }
}

function decodeBytes(bytes: string, encoding: 'base64' | 'base58'): Uint8Array {
  switch (encoding) {
    case 'base58':
      return bs58.decode(bytes);
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

export const initializeHandlers = (services: XMIFServices) => [
  new SendOtpEventHandler(services),
  new CreateSignerEventHandler(services),
  new GetPublicKeyEventHandler(services),
  new SignEventHandler(services),
  new GetStatusEventHandler(services),
];
