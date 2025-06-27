import type {
  SignerIFrameEventName,
  SignerInputEvent,
  SignerOutputEvent,
} from '@crossmint/client-signers';
import type { CrossmintFrameServices } from '..';
import { decodeBytes } from '@crossmint/client-signers-cryptography';
import { measureFunctionTime } from '@crossmint/client-signers-cryptography';
import { CrossmintFrameCodedError } from '../api/error';

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

  constructor(protected readonly services: CrossmintFrameServices) {}

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
        ...(error instanceof CrossmintFrameCodedError && { code: error.code }),
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
    const masterSecret = await this.services.userKeyManager.tryGetAndDecryptMasterSecret(
      payload.authData
    );

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
          publicKey: await this.services.encryptionKeyProvider.getSerializedPublicKey(),
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
    const otp = await this.decryptOtp(encryptedOtp);
    const senderPublicKey = await this.services.encryptionKeyProvider.getSerializedPublicKey();

    const { encryptedUserKey, userKeyHash } = await this.services.api.completeOnboarding(
      {
        publicKey: senderPublicKey,
        onboardingAuthentication: {
          otp,
        },
        deviceId,
      },
      payload.authData
    );

    const masterSecret = await this.services.userKeyManager.verifyAndReconstructMasterSecret({
      deviceId,
      encryptedUserKey,
      userKeyHash,
    });

    return {
      status: 'success',
      signerStatus: 'ready',
      publicKeys: await this.services.cryptoKey.getAllPublicKeysFromSeed(
        new Uint8Array(masterSecret)
      ),
    };
  }

  private async decryptOtp(encrypted: string): Promise<string> {
    const decryptedOtpArray = await this.services.fpe.decrypt(this.stringToNumberArray(encrypted));
    return decryptedOtpArray.join('');
  }

  private stringToNumberArray(str: string): number[] {
    return str.split('').map(Number);
  }
}

export class GetStatusEventHandler extends EventHandler<'get-status'> {
  event = 'request:get-status' as const;
  responseEvent = 'response:get-status' as const;

  async handler(
    payload: SignerInputEvent<'get-status'>
  ): Promise<SuccessfulOutputEvent<'get-status'>> {
    const masterSecret = await this.services.userKeyManager.tryGetAndDecryptMasterSecret(
      payload.authData
    );

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
    const masterSecret = await this.services.userKeyManager.tryGetAndDecryptMasterSecret(
      payload.authData
    );
    if (masterSecret == null) {
      throw new Error('Device is not initialized. Please complete onboarding first.');
    }

    const { keyType, bytes, encoding } = payload.data;
    const privateKey = await this.services.cryptoKey.getPrivateKeyFromSeed(keyType, masterSecret);
    const message = decodeBytes(bytes, encoding);

    const { signature, publicKey } = await this.services.cryptoKey.sign(
      keyType,
      privateKey,
      message
    );
    return {
      status: 'success',
      signature,
      publicKey,
    };
  }
}

export const initializeHandlers = (services: CrossmintFrameServices) => [
  new CompleteOnboardingEventHandler(services),
  new StartOnboardingEventHandler(services),
  new SignEventHandler(services),
  new GetStatusEventHandler(services),
];
