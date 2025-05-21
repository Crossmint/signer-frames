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
  ): Promise<Omit<Extract<SignerOutputEvent<EventName>, { status: 'success' }>, 'status'>>;

  constructor(protected readonly services: XMIFServices) {}

  async callback(payload: SignerInputEvent<EventName>): Promise<SignerOutputEvent<EventName>> {
    try {
      const result = await measureFunctionTime(`[${this.event} handler]`, async () =>
        this.handler(payload)
      );
      return {
        status: 'success' as const,
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
      const publicKey = await this.services.keyGeneration.getPublicKeyFromSeed(
        payload.data.keyType,
        masterSecret
      );
      return {
        publicKey,
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

export class GetAttestationEventHandler extends EventHandler<'get-attestation'> {
  event = 'request:get-attestation' as const;
  responseEvent = 'response:get-attestation' as const;

  async handler(payload: SignerInputEvent<'get-attestation'>) {
    const attestationDocument = {} as Record<string, unknown>;
    return {
      attestationDocument,
    };
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
    return {
      publicKey: await this.services.keyGeneration.getPublicKeyFromSeed(
        payload.data.keyType,
        masterSecret
      ),
    };
  }
}

export class GetPublicKeyEventHandler extends EventHandler<'get-public-key'> {
  event = 'request:get-public-key' as const;
  responseEvent = 'response:get-public-key' as const;

  async handler(payload: SignerInputEvent<'get-public-key'>) {
    const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);
    return {
      publicKey: await this.services.keyGeneration.getPublicKeyFromSeed(
        payload.data.keyType,
        masterSecret
      ),
    };
  }
}

export class GetStatusEventHandler extends EventHandler<'get-status'> {
  event = 'request:get-status' as const;
  responseEvent = 'response:get-status' as const;

  async handler(payload: SignerInputEvent<'get-status'>) {
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
          signature: {
            bytes: bs58.encode(await this.services.ed25519.sign(message, secretKey)),
            encoding: 'base58' as const,
          },
          publicKey: await this.services.keyGeneration.getPublicKeyFromSeed(keyType, masterSecret),
        };
      }
      case 'secp256k1': {
        const message = decodeBytes(bytes, encoding);
        const privKey = await this.services.secp256k1.privateKeyFromSeed(masterSecret);
        return {
          signature: {
            bytes: await this.services.secp256k1.sign(message, privKey),
            encoding: 'base64' as const, // TODO: Use hex. It's hex
          },
          publicKey: await this.services.keyGeneration.getPublicKeyFromSeed(keyType, masterSecret),
        };
      }
      default:
        throw new Error(`Key type not implemented: ${keyType}`);
    }
  }
}

function decodeBytes(bytes: string, encoding: 'base64' | 'base58' | 'hex'): Uint8Array {
  switch (encoding) {
    case 'base58':
      return bs58.decode(bytes);
    case 'hex':
      return Buffer.from(bytes.replace('0x', ''), 'hex');
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
  new GetAttestationEventHandler(services),
];
