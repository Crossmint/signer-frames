import type {
  SignerIFrameEventName,
  SignerInputEvent,
  SignerOutputEvent,
} from '@crossmint/client-signers';
import type { CrossmintApiService } from './api';
import type { ShardingService } from './sharding-service';
import { base64Decode } from '../utils';
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
  abstract handler(payload: SignerInputEvent<EventName>): Promise<SignerOutputEvent<EventName>>;
  async callback(payload: SignerInputEvent<EventName>): Promise<SignerOutputEvent<EventName>> {
    const result = await measureFunctionTime(`[${this.event} handler]`, async () =>
      this.handler(payload)
    );
    return result;
  }
  options = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

export class CreateSignerEventHandler extends BaseEventHandler<'create-signer'> {
  constructor(private readonly api: CrossmintApiService) {
    super();
  }
  event = 'request:create-signer' as const;
  responseEvent = 'response:create-signer' as const;
  async handler(payload: SignerInputEvent<'create-signer'>) {
    if (!this.api) {
      throw new Error('API service is not available');
    }
    await this.api.createSigner(payload.deviceId, payload.authData, payload.data);
    return {};
  }
}

export class SendOtpEventHandler extends BaseEventHandler<'send-otp'> {
  constructor(
    private readonly api: CrossmintApiService,
    private readonly shardingService: ShardingService
  ) {
    super();
  }
  event = 'request:send-otp' as const;
  responseEvent = 'response:send-otp' as const;
  handler = async (payload: SignerInputEvent<'send-otp'>) => {
    const response = await this.api.sendOtp(payload.deviceId, payload.authData, {
      otp: payload.data.encryptedOtp,
    });
    await Promise.all([
      this.shardingService.storeDeviceKeyShardLocally({
        deviceId: payload.deviceId,
        data: response.shares.device,
      }),
      this.shardingService.storeAuthKeyShardLocally({
        deviceId: payload.deviceId,
        data: response.shares.auth,
      }),
    ]);
    const { publicKey } = await this.shardingService.recombineShards(
      base64Decode(response.shares.device),
      base64Decode(response.shares.auth),
      payload.data.chainLayer
    );
    return {
      address: publicKey,
    };
  };
}

export class GetPublicKeyEventHandler extends BaseEventHandler<'get-public-key'> {
  constructor(
    private readonly api: CrossmintApiService,
    private readonly shardingService: ShardingService
  ) {
    super();
  }
  event = 'request:get-public-key' as const;
  responseEvent = 'response:get-public-key' as const;
  handler = async (payload: SignerInputEvent<'get-public-key'>) => {
    const { keyShare } = await this.api.getAuthShard(payload.deviceId, payload.authData);
    const { publicKey } = await this.shardingService.reconstructKey(
      {
        deviceId: payload.deviceId,
        data: keyShare,
      },
      payload.data.chainLayer
    );
    return {
      publicKey,
    };
  };
}

export class SignMessageEventHandler extends BaseEventHandler<'sign-message'> {
  event = 'request:sign-message' as const;
  responseEvent = 'response:sign-message' as const;
  handler = async (payload: SignerInputEvent<'sign-message'>) => {
    throw new Error('Not implemented');
  };
}

export class SignTransactionEventHandler extends BaseEventHandler<'sign-transaction'> {
  event = 'request:sign-transaction' as const;
  responseEvent = 'response:sign-transaction' as const;
  handler = async (payload: SignerInputEvent<'sign-transaction'>) => {
    throw new Error('Not implemented');
  };
}
