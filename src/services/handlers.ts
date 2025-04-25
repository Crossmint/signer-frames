import type {
  SignerIFrameEventName,
  SignerInputEvent,
  SignerOutputEvent,
} from '@crossmint/client-signers';
import type { CrossmintApiService } from './api';
import type { ShardingService } from './sharding-service';
import type { SolanaService } from './SolanaService';
const DEFAULT_TIMEOUT_MS = 10_000;

const measureFunctionTime = async <T>(fnName: string, fn: () => Promise<T>): Promise<T> => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  console.log(`Function ${fnName} took ${end - start}ms to execute`);
  return result;
};

export interface EventHandler {
  event: `request:${SignerIFrameEventName}`;
  responseEvent: `response:${SignerIFrameEventName}`;
  callback: (
    payload: SignerInputEvent<SignerIFrameEventName>
  ) => Promise<SignerOutputEvent<SignerIFrameEventName>>;
  options: {
    timeoutMs?: number;
  };
}

abstract class BaseEventHandler<EventName extends SignerIFrameEventName> {
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
    private readonly api: CrossmintApiService,
    private readonly shardingService: ShardingService
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
      const { publicKey } = await this.shardingService.getLocalKeyInstance(
        payload.authData,
        payload.data.chainLayer
      );
      return {
        address: publicKey,
      };
    }

    console.log('Signer not yet initialized, creating a new one...');
    const deviceId = this.shardingService.getDeviceId();
    await this.api.createSigner(deviceId, payload.authData, payload.data);
    return {};
  }
}

export class SendOtpEventHandler extends BaseEventHandler<'send-otp'> {
  constructor(
    private readonly api: CrossmintApiService,
    private readonly shardingService: ShardingService,
    private readonly solanaService: SolanaService
  ) {
    super();
  }
  event = 'request:send-otp' as const;
  responseEvent = 'response:send-otp' as const;
  handler = async (payload: SignerInputEvent<'send-otp'>) => {
    const deviceId = this.shardingService.getDeviceId();
    const response = await this.api.sendOtp(deviceId, payload.authData, {
      otp: payload.data.encryptedOtp,
    });

    this.shardingService.storeDeviceShare(response.shares.device);
    this.shardingService.cacheAuthShare(response.shares.auth);

    const masterSecret = await this.shardingService.getMasterSecret(payload.authData);
    return {
      address: this.solanaService.getKeypair(masterSecret).publicKey.toBase58(),
    };
  };
}

export class GetPublicKeyEventHandler extends BaseEventHandler<'get-public-key'> {
  constructor(
    private readonly shardingService: ShardingService,
    private readonly solanaService: SolanaService
  ) {
    super();
  }
  event = 'request:get-public-key' as const;
  responseEvent = 'response:get-public-key' as const;
  handler = async (payload: SignerInputEvent<'get-public-key'>) => {
    const masterSecret = await this.shardingService.getMasterSecret(payload.authData);
    return {
      publicKey: this.solanaService.getKeypair(masterSecret).publicKey.toBase58(),
    };
  };
}

export class SignMessageEventHandler extends BaseEventHandler<'sign-message'> {
  constructor(
    private readonly shardingService: ShardingService,
    private readonly solanaService: SolanaService
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
    const keypair = this.solanaService.getKeypair(masterSecret);
    const signature = await this.solanaService.signMessage(payload.data.message, keypair);
    return { signature, publicKey: keypair.publicKey.toBase58() };
  }
}

export class SignTransactionEventHandler extends BaseEventHandler<'sign-transaction'> {
  constructor(
    private readonly shardingService: ShardingService,
    private readonly solanaService: SolanaService
  ) {
    super();
  }
  event = 'request:sign-transaction' as const;
  responseEvent = 'response:sign-transaction' as const;
  handler = async (payload: SignerInputEvent<'sign-transaction'>) => {
    if (payload.data.chainLayer !== 'solana') {
      throw new Error('Chain layer not implemented');
    }

    const masterSecret = await this.shardingService.getMasterSecret(payload.authData);
    const keypair = this.solanaService.getKeypair(masterSecret);
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
