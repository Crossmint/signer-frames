import type {
  KeyType,
  Encoding,
  SignerIFrameEventName,
  SignerInputEvent,
  SignerOutputEvent,
} from '@crossmint/client-signers';
import bs58 from 'bs58';
import type { XMIFServices } from '.';
import { measureFunctionTime } from './utils';
import { XMIFCodedError } from './error';

const DEFAULT_TIMEOUT_MS = 30_000;
type SuccessfulOutputEvent<EventName extends SignerIFrameEventName> = Extract<
  SignerOutputEvent<EventName>,
  { status: 'success' }
>;

export abstract class EventHandler<
  EventName extends SignerIFrameEventName = SignerIFrameEventName,
> {
  abstract event: `request:${EventName}`;
  abstract responseEvent: `response:${EventName}`;

  abstract handler(payload: SignerInputEvent<EventName>): Promise<SuccessfulOutputEvent<EventName>>;

  constructor(protected readonly services: XMIFServices) {}

  async callback(payload: SignerInputEvent<EventName>): Promise<SignerOutputEvent<EventName>> {
    try {
      const result = await measureFunctionTime(`[${this.event} handler]`, async () =>
        this.handler(payload)
      );
      return result;
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

export class StartOnboardingEventHandler extends EventHandler<'start-onboarding'> {
  event = 'request:start-onboarding' as const;
  responseEvent = 'response:start-onboarding' as const;

  async handler(
    payload: SignerInputEvent<'start-onboarding'>
  ): Promise<SuccessfulOutputEvent<'start-onboarding'>> {
    const signerStatus = this.services.sharding.status();
    if (signerStatus === 'ready') {
      const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);
      const publicKeys = await this.services.cryptoKey.getAllPublicKeysFromSeed(masterSecret);
      console.log(`[DEBUG, ${this.event} handler] Public keys: ${publicKeys}`);
      return {
        status: 'success' as const,
        signerStatus,
        publicKeys,
      };
    }

    await this.services.api.startOnboarding(
      {
        ...payload.data,
        encryptionContext: {
          publicKey: await this.services.encrypt.getPublicKey(),
        },
        deviceId: this.services.sharding.getDeviceId(),
      },
      payload.authData
    );

    return {
      status: 'success' as const,
      signerStatus,
    };
  }
}

export class GetAttestationEventHandler extends EventHandler<'get-attestation'> {
  event = 'request:get-attestation' as const;
  responseEvent = 'response:get-attestation' as const;

  async handler(
    payload: SignerInputEvent<'get-attestation'>
  ): Promise<SuccessfulOutputEvent<'get-attestation'>> {
    const attestationDocument = await this.services.attestation.getAttestationDocument();
    return {
      status: 'success' as const,
      attestationDocument,
    };
  }
}

export class CompleteOnboardingEventHandler extends EventHandler<'complete-onboarding'> {
  event = 'request:complete-onboarding' as const;
  responseEvent = 'response:complete-onboarding' as const;

  async handler(
    payload: SignerInputEvent<'complete-onboarding'>
  ): Promise<SuccessfulOutputEvent<'complete-onboarding'>> {
    const deviceId = this.services.sharding.getDeviceId();
    const encryptedOtp = payload.data.onboardingAuthentication.encryptedOtp;
    console.log(
      `[DEBUG, ${this.event} handler] Received encrypted OTP: ${encryptedOtp}. Decrypting`
    );
    const decryptedOtp = (await this.services.fpe.decrypt(encryptedOtp.split('').map(Number))).join(
      ''
    );
    const senderPublicKey = await this.services.encrypt.getPublicKey();

    const response = await this.services.api.completeOnboarding(
      {
        publicKey: senderPublicKey,
        onboardingAuthentication: {
          otp: decryptedOtp,
        },
        deviceId,
      },
      payload.authData
    );

    this.services.sharding.storeDeviceShare(response.shares.device);
    const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);
    const publicKeys = await this.services.cryptoKey.getAllPublicKeysFromSeed(masterSecret);
    console.log(`[DEBUG, ${this.event} handler] Public keys: ${publicKeys}`);
    return {
      status: 'success' as const,
      signerStatus: 'ready' as const,
      publicKeys,
    };
  }
}

export class GetStatusEventHandler extends EventHandler<'get-status'> {
  event = 'request:get-status' as const;
  responseEvent = 'response:get-status' as const;

  async handler(
    payload: SignerInputEvent<'get-status'>
  ): Promise<SuccessfulOutputEvent<'get-status'>> {
    const signerStatus = this.services.sharding.status();
    switch (signerStatus) {
      case 'ready': {
        const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);
        const publicKeys = await this.services.cryptoKey.getAllPublicKeysFromSeed(masterSecret);
        console.log(`[DEBUG, ${this.event} handler] Public keys: ${publicKeys}`);
        return {
          status: 'success',
          signerStatus,
          publicKeys,
        };
      }
      case 'new-device': {
        return {
          status: 'success' as const,
          signerStatus,
        };
      }
    }
  }
}

export class SignEventHandler extends EventHandler<'sign'> {
  event = 'request:sign' as const;
  responseEvent = 'response:sign' as const;

  async handler(payload: SignerInputEvent<'sign'>): Promise<SuccessfulOutputEvent<'sign'>> {
    const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);
    const { keyType, bytes, encoding } = payload.data;
    const privateKey = await this.services.cryptoKey.getPrivateKeyFromSeed(keyType, masterSecret);
    const message = decodeBytes(bytes, encoding);
    const signature = await this.services.cryptoKey.sign(keyType, privateKey, message);
    const publicKey = await this.services.cryptoKey.getPublicKeyFromSeed(keyType, masterSecret);
    return {
      status: 'success' as const,
      signature,
      publicKey,
    };
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
  new CompleteOnboardingEventHandler(services),
  new StartOnboardingEventHandler(services),
  new SignEventHandler(services),
  new GetStatusEventHandler(services),
  new GetAttestationEventHandler(services),
];
