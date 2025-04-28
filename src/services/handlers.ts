import type {
  SignerIFrameEventName,
  SignerInputEvent,
  SignerOutputEvent,
} from '@crossmint/client-signers';
import bs58 from 'bs58';
import type { XMIFServices } from '.';
const DEFAULT_TIMEOUT_MS = 10_000;

const measureFunctionTime = async <T>(fnName: string, fn: () => Promise<T>): Promise<T> => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  console.log(`Function ${fnName} took ${end - start}ms to execute`);
  return result;
};
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

class CreateSignerEventHandler extends BaseEventHandler<'create-signer'> {
  constructor(
    services: XMIFServices,
    private readonly api = services.api,
    private readonly shardingService = services.sharding,
    private readonly solanaService = services.solana
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
      const keypair = await this.solanaService.getKeypair(masterSecret);
      return {
        address: keypair.publicKey.toBase58(),
      };
    }

    console.log('Signer not yet initialized, creating a new one...');
    const deviceId = this.shardingService.getDeviceId();
    await this.api.createSigner({
      deviceId,
      authData: payload.authData,
      data: payload.data,
    });
    return {};
  }
}

class SendOtpEventHandler extends BaseEventHandler<'send-otp'> {
  constructor(
    services: XMIFServices,
    private readonly api = services.api,
    private readonly shardingService = services.sharding,
    private readonly ed25519Service = services.ed25519
  ) {
    super();
  }
  event = 'request:send-otp' as const;
  responseEvent = 'response:send-otp' as const;
  handler = async (payload: SignerInputEvent<'send-otp'>) => {
    const deviceId = this.shardingService.getDeviceId();
    const decryptedOtp = '';
    const response = await this.api.sendOtp({
      deviceId,
      authData: payload.authData,
      data: {
        otp: decryptedOtp,
      },
    });

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

class GetPublicKeyEventHandler extends BaseEventHandler<'get-public-key'> {
  constructor(
    services: XMIFServices,
    private readonly shardingService = services.sharding,
    private readonly ed25519Service = services.ed25519
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

class SignMessageEventHandler extends BaseEventHandler<'sign-message'> {
  constructor(
    services: XMIFServices,
    private readonly shardingService = services.sharding,
    private readonly ed25519Service = services.ed25519
  ) {
    super();
  }
  event = 'request:sign-message' as const;
  responseEvent = 'response:sign-message' as const;
  async handler(payload: SignerInputEvent<'sign-message'>) {
    if (payload.data.chainLayer !== 'solana') {
      throw new Error('Chain layer not implemented');
    }

    const masterSecret = await this.shardingService.getMasterSecret(payload.authData);
    const secretKey = await this.ed25519Service.secretKeyFromSeed(masterSecret);
    const signature = await this.ed25519Service.sign(payload.data.message, secretKey);
    const publicKey = await this.ed25519Service.getPublicKey(secretKey);
    return {
      signature: bs58.encode(signature),
      publicKey,
    };
  }
}

class SignTransactionEventHandler extends BaseEventHandler<'sign-transaction'> {
  constructor(
    services: XMIFServices,
    private readonly shardingService = services.sharding,
    private readonly solanaService = services.solana // TODO: just use the ed25519 service
  ) {
    super();
  }
  event = 'request:sign-transaction' as const;
  responseEvent = 'response:sign-transaction' as const;
  requiresAttestationValidation = false;
  handler = async (payload: SignerInputEvent<'sign-transaction'>) => {
    if (payload.data.chainLayer !== 'solana') {
      throw new Error('Chain layer not implemented');
    }

    const masterSecret = await this.shardingService.getMasterSecret(payload.authData);
    const keypair = await this.solanaService.getKeypair(masterSecret);
    const { transaction, signature } = await this.solanaService.signTransaction(
      payload.data.transaction,
      keypair
    );

    return {
      publicKey: keypair.publicKey.toBase58(),
      transaction,
      signature,
    };
  };
}

// class SignEventHandler extends BaseEventHandler<'sign'> {
//   constructor(
//     services: XMIFServices,
//     private readonly shardingService = services.sharding,
//     private readonly edd25519Service = services.ed25519
//   ) {
//     super();
//   }
//   event = 'request:sign' as const;
//   responseEvent = 'response:sign' as const;
//   handler = async (payload: SignerInputEvent<'sign'>) => {
//     const masterSecret = await this.shardingService.getMasterSecret(payload.authData);
//     const { algorithm, message } = payload.data;
//     switch (algorithm) {
//       case 'ed25519': {
//         const secretKey = await this.edd25519Service.secretKeyFromSeed(masterSecret);
//         return this.edd25519Service.sign(message, secretKey);
//       }
//       default:
//         throw new Error(`Algorithm not implemented: ${algorithm}`);
//     }
//   };
// }

export const initializeHandlers = (services: XMIFServices) => [
  new SendOtpEventHandler(services),
  new SignMessageEventHandler(services),
  new SignTransactionEventHandler(services),
  new CreateSignerEventHandler(services),
  new GetPublicKeyEventHandler(services),
  // new SignEventHandler(services),
];
