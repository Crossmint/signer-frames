import type {
  SignerIFrameEventName,
  SignerInputEvent,
  SignerOutputEvent,
} from '@crossmint/client-signers';
import type { CrossmintApiService } from './api';
import type { ShardingService } from './sharding-service';
import type { SolanaService } from './solana';
import type {
  AttestationService,
  ValidateAttestationDocumentResult,
  EncryptionData,
} from './attestation';
import type { Ed25519Service } from './ed25519';
import bs58 from 'bs58';
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

  requiresAttestationValidation: boolean;
  validateAttestationDocument: () => Promise<ValidateAttestationDocumentResult>;
}

abstract class BaseEventHandler<EventName extends SignerIFrameEventName> {
  abstract event: `request:${EventName}`;
  abstract responseEvent: `response:${EventName}`;
  abstract handler(
    payload: SignerInputEvent<EventName>,
    encryptionData?: EncryptionData
  ): Promise<Omit<SignerOutputEvent<EventName>, 'status'>>;
  async callback(
    payload: SignerInputEvent<EventName>,
    encryptionData?: EncryptionData
  ): Promise<SignerOutputEvent<EventName>> {
    try {
      const result = await measureFunctionTime(`[${this.event} handler]`, async () =>
        this.handler(payload, encryptionData)
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

// This class will validate the attestation document before calling the handler
abstract class AttestedEventHandler<
  EventName extends SignerIFrameEventName,
> extends BaseEventHandler<EventName> {
  constructor(private readonly attestationService: AttestationService) {
    super();
  }
  async validateAttestationDocument() {
    return this.attestationService.validateAttestationDocument();
  }

  async callback(payload: SignerInputEvent<EventName>): Promise<SignerOutputEvent<EventName>> {
    let encryptionData: EncryptionData | undefined;
    try {
      const result = await measureFunctionTime(
        `[${this.event} handler] Validating attestation document`,
        async () => {
          return this.validateAttestationDocument();
        }
      );
      if (!result.validated) {
        throw new Error(`Error validating attestation document: ${result.error}`);
      }
      encryptionData = {
        publicKey: result.publicKey,
      };
    } catch (error: unknown) {
      console.error(`[${this.event} handler] Error validating attestation document: ${error}`);
      throw error;
    }
    return super.callback(payload, encryptionData);
  }
}

export class CreateSignerEventHandler extends BaseEventHandler<'create-signer'> {
  constructor(
    private readonly api: CrossmintApiService,
    private readonly shardingService: ShardingService,
    private readonly solanaService: SolanaService
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
    await this.api.createSigner(deviceId, payload.authData, payload.data);
    return {};
  }
}

export class SendOtpEventHandler extends AttestedEventHandler<'send-otp'> {
  constructor(
    private readonly api: CrossmintApiService,
    private readonly shardingService: ShardingService,
    private readonly ed25519Service: Ed25519Service,
    attestationService: AttestationService
  ) {
    super(attestationService);
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
    const secretKey = await this.ed25519Service.secretKeyFromSeed(masterSecret);
    const publicKey = await this.ed25519Service.getPublicKey(secretKey);
    return {
      address: publicKey,
    };
  };
}

export class GetPublicKeyEventHandler extends BaseEventHandler<'get-public-key'> {
  constructor(
    private readonly shardingService: ShardingService,
    private readonly ed25519Service: Ed25519Service
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

export class SignMessageEventHandler extends BaseEventHandler<'sign-message'> {
  constructor(
    private readonly shardingService: ShardingService,
    private readonly ed25519Service: Ed25519Service
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

export class SignTransactionEventHandler extends BaseEventHandler<'sign-transaction'> {
  constructor(
    private readonly shardingService: ShardingService,
    private readonly solanaService: SolanaService // TODO: just use the ed25519 service
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

// export class SignEventHandler extends BaseEventHandler<'sign'> {
//   constructor(
//     private readonly shardingService: ShardingService,
//     private readonly edd25519Service: Ed25519Service
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
