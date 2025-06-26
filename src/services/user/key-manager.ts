import { z } from 'zod';
import { SymmetricEncryptionHandler } from '../encryption/lib/encryption/symmetric/standard/handler';
import { CrossmintFrameService } from '../service';
import { ECDHKeyProvider } from '../encryption/lib/key-management/ecdh-key-provider';
import { KeyPairProvider } from '../encryption/lib/key-management/provider';
import { PublicKeyDeserializer } from '../encryption-keys/tee-key-provider';
import { decodeBytes, encodeBytes } from '../encryption/lib/utils';
import { AuthData } from '../api/request';
import { CrossmintApiService } from '../api';
import { DeviceService } from './device';
import { InMemoryCacheService } from '../storage/cache';

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

type CompleteOnboardingOutput = z.infer<typeof completeOnboardingOutputSchema>;

export class UserKeyManager extends CrossmintFrameService {
  name = 'User Key Manager';
  log_prefix = '[UserKeyManager]';

  constructor(
    private readonly api: CrossmintApiService,
    private readonly keyProvider: KeyPairProvider,
    private readonly deviceService: DeviceService,
    private readonly cache: InMemoryCacheService,
    private readonly encryptionHandler = new SymmetricEncryptionHandler()
  ) {
    super();
  }

  async tryGetMasterSecret(authData: AuthData): Promise<Uint8Array | null> {
    let encryptedMasterSecret: CompleteOnboardingOutput | null = await this.tryGetFromCache();
    encryptedMasterSecret = encryptedMasterSecret ?? (await this.tryGetFromApi(authData));
    if (encryptedMasterSecret != null) {
      this.cache.set('encryptedMasterSecret', encryptedMasterSecret);
      const masterSecret = await this.verifyAndReconstructMasterSecret(encryptedMasterSecret);
      return masterSecret;
    }
    return null;
  }

  async tryGetFromCache(): Promise<CompleteOnboardingOutput | null> {
    const encryptedMasterSecret = this.cache.get(
      'encryptedMasterSecret',
      completeOnboardingOutputSchema
    );
    if (encryptedMasterSecret == null) {
      return null;
    }
    return encryptedMasterSecret as CompleteOnboardingOutput;
  }

  async tryGetFromApi(authData: AuthData): Promise<CompleteOnboardingOutput | null> {
    try {
      const encryptedMasterSecret = await this.api.getEncryptedMasterSecret(
        this.deviceService.getId(),
        authData
      );
      this.cache.set('encryptedMasterSecret', encryptedMasterSecret);
      return encryptedMasterSecret;
    } catch (error) {
      this.logError('Error getting encrypted master secret from API:', error, '. Continuing...');
      return null;
    }
  }

  async verifyAndReconstructMasterSecret({
    encryptedUserKey,
    userKeyHash,
    signature: _signature,
  }: z.infer<typeof completeOnboardingOutputSchema>) {
    const teePublicKey = encryptedUserKey.encryptionPublicKey;
    try {
      const encryptionKey = await this.getEncryptionKey(teePublicKey);
      const masterSecret = await this.encryptionHandler.decrypt(
        decodeBytes(encryptedUserKey.bytes, encryptedUserKey.encoding),
        encryptionKey
      );

      console.log('Master secret', masterSecret);
      this.verifyHash(masterSecret, userKeyHash);
      return masterSecret;
    } catch (error) {
      console.error('Error decrypting master secret', error);
      throw error;
    }
  }

  private async getEncryptionKey(teePublicKey: string): Promise<CryptoKey> {
    return new ECDHKeyProvider(this.keyProvider, {
      getPublicKey: async () => {
        return new PublicKeyDeserializer().deserialize(teePublicKey);
      },
    }).getSymmetricKey();
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
