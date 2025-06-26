import { z } from 'zod';
import { SymmetricEncryptionHandler } from '../encryption/lib/symmetric-encryption-handler';
import { CrossmintFrameService } from '../service';
import { SymmetricEncryptionKeyProvider } from '../encryption/lib/symmetric-encryption-key-provider';
import { KeyPairProvider } from '../encryption/lib/provider';
import { PublicKeyDeserializer } from '../encryption-keys/tee-key-provider';
import { decodeBytes, encodeBytes } from '../encryption/lib/utils';

const completeOnboardingOutputSchema = z.object({
  deviceId: z.string(),
  signerId: z.string(),
  encryptedUserKey: z.object({
    bytes: z.string(),
    encoding: z.literal('base64'),
    encryptionPublicKey: z.string(),
  }),
  userKeyHash: z.object({
    bytes: z.string(),
    encoding: z.literal('base64'),
    algorithm: z.literal('SHA-256'),
  }),
  signature: z.object({
    bytes: z.string(),
    encoding: z.literal('base64'),
    algorithm: z.literal('ECDSA'),
    signingPublicKey: z.string(),
  }),
});

export class UserKeyManager extends CrossmintFrameService {
  name = 'User Key Manager';
  log_prefix = '[UserKeyManager]';

  constructor(private readonly keyProvider: KeyPairProvider) {
    super();
  }

  async verifyAndReconstructMasterSecret({
    encryptedUserKey,
    userKeyHash,
    signature: _signature,
  }: z.infer<typeof completeOnboardingOutputSchema>) {
    console.log('Verifying and reconstructing master secret');
    console.log('Encrypted user key', encryptedUserKey);
    const teePublicKey = encryptedUserKey.encryptionPublicKey;
    console.log('Tee public key', teePublicKey);
    const encryptionHandler = new SymmetricEncryptionHandler(
      new SymmetricEncryptionKeyProvider(this.keyProvider, {
        getPublicKey: async () => {
          return new PublicKeyDeserializer().deserialize(teePublicKey);
        },
      })
    );
    console.log('Decrypting master secret');
    try {
      const masterSecret = await encryptionHandler.decrypt(
        decodeBytes(encryptedUserKey.bytes, encryptedUserKey.encoding)
      );

      console.log('Master secret', masterSecret);
      this.verifyHash(masterSecret, userKeyHash);
      return masterSecret;
    } catch (error) {
      console.error('Error decrypting master secret', error);
      throw error;
    }
  }

  private async verifyHash(
    userKey: Uint8Array,
    userKeyHash: z.infer<typeof completeOnboardingOutputSchema>['userKeyHash']
  ) {
    const hash = await crypto.subtle.digest(userKeyHash.algorithm, userKey);
    const reconstructedUserKeyHash = encodeBytes(new Uint8Array(hash), userKeyHash.encoding);
    if (reconstructedUserKeyHash !== userKeyHash.bytes) {
      throw new Error('User key hash does not match');
    }
    console.log('User key hash verified');
  }
}
