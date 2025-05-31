import type {
  SignerIFrameEventName,
  SignerInputEvent,
  SignerOutputEvent,
} from '@crossmint/client-signers';
import type { XMIFServices } from '.';
import { decodeBytes, measureFunctionTime } from './utils';
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
    const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);

    if (masterSecret != null) {
      return {
        status: 'success',
        signerStatus: 'ready',
        publicKeys: await this.services.cryptoKey.getAllPublicKeysFromSeed(masterSecret),
      };
    }

    await this.services.api.startOnboarding(
      {
        ...payload.data,
        encryptionContext: {
          publicKey: await this.services.encrypt.getPublicKey(),
        },
        deviceId: this.services.device.getId(),
      },
      payload.authData
    );

    return {
      status: 'success',
      signerStatus: 'new-device',
    };
  }
}

export class CompleteOnboardingEventHandler extends EventHandler<'complete-onboarding'> {
  event = 'request:complete-onboarding' as const;
  responseEvent = 'response:complete-onboarding' as const;

  async handler(
    payload: SignerInputEvent<'complete-onboarding'>
  ): Promise<SuccessfulOutputEvent<'complete-onboarding'>> {
    const deviceId = this.services.device.getId();
    const encryptedOtp = payload.data.onboardingAuthentication.encryptedOtp;
    console.log(
      `[DEBUG, ${this.event} handler] Received encrypted OTP: ${encryptedOtp}. Decrypting`
    );
    const decryptedOtp = (await this.services.fpe.decrypt(encryptedOtp.split('').map(Number))).join(
      ''
    );
    const senderPublicKey = await this.services.encrypt.getPublicKey();

    const { deviceKeyShare, signerId } = await this.services.api.completeOnboarding(
      {
        publicKey: senderPublicKey,
        onboardingAuthentication: {
          otp: decryptedOtp,
        },
        deviceId,
      },
      payload.authData
    );

    this.services.sharding.storeDeviceShare(signerId, deviceKeyShare);
    const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);
    if (masterSecret == null) {
      throw new Error('Device share not found');
    }

    return {
      status: 'success',
      signerStatus: 'ready',
      publicKeys: await this.services.cryptoKey.getAllPublicKeysFromSeed(masterSecret),
    };
  }
}

export class GetStatusEventHandler extends EventHandler<'get-status'> {
  event = 'request:get-status' as const;
  responseEvent = 'response:get-status' as const;

  async handler(
    payload: SignerInputEvent<'get-status'>
  ): Promise<SuccessfulOutputEvent<'get-status'>> {
    const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);

    if (masterSecret == null) {
      return {
        status: 'success',
        signerStatus: 'new-device',
      };
    }

    return {
      status: 'success',
      signerStatus: 'ready',
      publicKeys: await this.services.cryptoKey.getAllPublicKeysFromSeed(masterSecret),
    };
  }
}

export class SignEventHandler extends EventHandler<'sign'> {
  event = 'request:sign' as const;
  responseEvent = 'response:sign' as const;

  async handler(payload: SignerInputEvent<'sign'>): Promise<SuccessfulOutputEvent<'sign'>> {
    const masterSecret = await this.services.sharding.reconstructMasterSecret(payload.authData);
    if (masterSecret == null) {
      throw new Error('Device share not found');
    }

    const { keyType, bytes, encoding } = payload.data;
    const privateKey = await this.services.cryptoKey.getPrivateKeyFromSeed(keyType, masterSecret);
    const message = decodeBytes(bytes, encoding);

    return {
      status: 'success',
      signature: await this.services.cryptoKey.sign(keyType, privateKey, message),
      publicKey: await this.services.cryptoKey.getPublicKeyFromSeed(keyType, masterSecret),
    };
  }
}

export const initializeHandlers = (services: XMIFServices) => [
  new CompleteOnboardingEventHandler(services),
  new StartOnboardingEventHandler(services),
  new SignEventHandler(services),
  new GetStatusEventHandler(services),
];
