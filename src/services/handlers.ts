import type {
  SignerIFrameEventName,
  SignerInputEvent,
  SignerOutputEvent,
} from '@crossmint/client-signers';
import bs58 from 'bs58';
import type { XMIFServices } from '.';
import { measureFunctionTime } from './utils';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface EventHandler<EventName extends SignerIFrameEventName = SignerIFrameEventName> {
  event: `request:${EventName}`;
  responseEvent: `response:${EventName}`;
  handler: (
    payload: SignerInputEvent<EventName>
  ) => Promise<Omit<SignerOutputEvent<EventName>, 'status'>>;
  callback: (payload: SignerInputEvent<EventName>) => Promise<SignerOutputEvent<EventName>>;
}
abstract class BaseEventHandler<EventName extends SignerIFrameEventName = SignerIFrameEventName> {
  abstract event: `request:${EventName}`;
  abstract responseEvent: `response:${EventName}`;
  abstract handler(
    payload: SignerInputEvent<EventName>
  ): Promise<Omit<SignerOutputEvent<EventName>, 'status'>>;
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
      console.error(`[${this.event} handler] Error: ${error}`);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  options = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

export class CreateSignerEventHandler extends BaseEventHandler<'create-signer'> {
  constructor(
    services: XMIFServices,
    private readonly api = services.api,
    private readonly shardingService = services.sharding,
    private readonly ed25519Service = services.ed25519,
    private readonly encryptionService = services.encrypt
  ) {
    super();
  }
  event = 'request:create-signer' as const;
  responseEvent = 'response:create-signer' as const;
  async handler(payload: SignerInputEvent<'create-signer'>) {
    if (!this.api) {
      throw new Error('API service is not available');
    }

    if (this.shardingService.getDeviceShare() != null) {
      const masterSecret = await this.shardingService.getMasterSecret(payload.authData);
      const publicKey = await this.ed25519Service.getPublicKey(masterSecret);
      return {
        address: publicKey,
      };
    }

    console.log('Signer not yet initialized, creating a new one...');
    const deviceId = this.shardingService.getDeviceId();
    await this.api.createSigner(
      deviceId,
      {
        ...payload.data,
        encryptionContext: {
          publicKey: await this.encryptionService.getPublicKey(),
        },
      },
      payload.authData
    );
    return {};
  }
}

export class SendOtpEventHandler extends BaseEventHandler<'send-otp'> {
  constructor(
    services: XMIFServices,
    private readonly api = services.api,
    private readonly shardingService = services.sharding,
    private readonly ed25519Service = services.ed25519,
    private readonly encryptionService = services.encrypt,
    private readonly fpeService = services.fpe
  ) {
    super();
  }
  event = 'request:send-otp' as const;
  responseEvent = 'response:send-otp' as const;
  handler = async (payload: SignerInputEvent<'send-otp'>) => {
    const deviceId = this.shardingService.getDeviceId();
    console.log(
      `[DEBUG, ${this.event} handler] Received encrypted OTP: ${payload.data.encryptedOtp}. Decrypting`
    );
    const decryptedOtp = (
      await this.fpeService.decrypt(payload.data.encryptedOtp.split('').map(Number))
    ).join('');
    console.log(`[DEBUG, ${this.event} handler] Decrypted OTP: ${decryptedOtp}.`);
    const senderPublicKey = await this.encryptionService.getPublicKey();
    const response = await this.api.sendOtp(
      deviceId,
      {
        otp: decryptedOtp,
        publicKey: senderPublicKey,
      },
      payload.authData
    );

    this.shardingService.storeDeviceShare(response.shares.device);
    this.shardingService.cacheAuthShare(response.shares.auth);

    const masterSecret = await this.shardingService.getMasterSecret(payload.authData);
    const secretKey = await this.ed25519Service.secretKeyFromSeed(masterSecret);
    const publicKey = await this.ed25519Service.getPublicKey(secretKey);
    return {
      address: publicKey,
    };
  };
}

export class GetPublicKeyEventHandler extends BaseEventHandler<'get-public-key'> {
  constructor(
    services: XMIFServices,
    private readonly shardingService = services.sharding,
    private readonly ed25519Service = services.ed25519,
    private readonly secp256k1Service = services.secp256k1
  ) {
    super();
  }
  event = 'request:get-public-key' as const;
  responseEvent = 'response:get-public-key' as const;
  handler = async (payload: SignerInputEvent<'get-public-key'>) => {
    const masterSecret = await this.shardingService.getMasterSecret(payload.authData);
    const secretKey = await this.ed25519Service.secretKeyFromSeed(masterSecret);
    const publicKey = await this.ed25519Service.getPublicKey(secretKey);
    return {
      publicKey,
    };
  };
}
class SignEventHandler extends BaseEventHandler<'sign'> {
  constructor(
    services: XMIFServices,
    private readonly shardingService = services.sharding,
    private readonly edd25519Service = services.ed25519,
    private readonly secp256k1Service = services.secp256k1
  ) {
    super();
  }
  event = 'request:sign' as const;
  responseEvent = 'response:sign' as const;
  handler = async (payload: SignerInputEvent<'sign'>) => {
    const masterSecret = await this.shardingService.getMasterSecret(payload.authData);
    const { keyType, bytes, encoding } = payload.data;
    switch (keyType) {
      case 'ed25519': {
        const message = decodeBytes(bytes, encoding);
        const secretKey = await this.edd25519Service.secretKeyFromSeed(masterSecret);
        return {
          signature: bs58.encode(await this.edd25519Service.sign(message, secretKey)),
          publicKey: await this.edd25519Service.getPublicKey(secretKey),
        };
      }
      case 'secp256k1': {
        const message = decodeBytes(bytes, encoding);
        const privKey = await this.secp256k1Service.privateKeyFromSeed(masterSecret);
        return {
          signature: await this.secp256k1Service.sign(message, privKey),
          publicKey: await this.secp256k1Service.getPublicKey(privKey),
        };
      }
      default:
        throw new Error(`Key type not implemented: ${keyType}`);
    }
  };
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
];
