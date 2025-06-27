import { CrossmintFrameService } from '../service';
import { KeyPairProvider, AesGcm } from '@crossmint/client-signers-cryptography';
import { decodeBytes, encodeBytes } from '@crossmint/client-signers-cryptography';
import { PublicKeyDeserializer } from '../encryption-keys/tee-key-provider';
import { AuthData } from '../api/request';
import { CrossmintApiService } from '../api';
import { DeviceService } from './device';
import { InMemoryCacheService } from '../storage/cache';
import { deriveSymmetricKey } from '@crossmint/client-signers-cryptography';
import {
  HashedEncryptedMasterSecret,
  hashedEncryptedMasterSecretSchema,
  UserMasterSecretHash,
} from './schemas';

export class UserKeyManager extends CrossmintFrameService {
  name = 'User Key Manager';
  log_prefix = '[UserKeyManager]';

  constructor(
    private readonly api: CrossmintApiService,
    private readonly keyProvider: KeyPairProvider,
    private readonly deviceService: DeviceService,
    private readonly cache: InMemoryCacheService,
    private readonly encryptionHandler = new AesGcm()
  ) {
    super();
  }

  async tryGetAndDecryptMasterSecret(authData: AuthData): Promise<Uint8Array | null> {
    const encryptedMasterSecret =
      (await this.tryGetFromCache()) ?? (await this.tryGetFromApi(authData));

    if (!encryptedMasterSecret) return null;

    const masterSecret = await this.verifyAndReconstructMasterSecret(encryptedMasterSecret);
    return new Uint8Array(masterSecret);
  }

  private async tryGetFromCache(): Promise<HashedEncryptedMasterSecret | null> {
    const cached = this.cache.get('encryptedMasterSecret', hashedEncryptedMasterSecretSchema);
    return cached as HashedEncryptedMasterSecret | null;
  }

  private async tryGetFromApi(authData: AuthData): Promise<HashedEncryptedMasterSecret | null> {
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
  }: HashedEncryptedMasterSecret) {
    const teePublicKey = encryptedUserKey.encryptionPublicKey;
    try {
      const encryptionKey = await this.getEncryptionKey(teePublicKey);
      const masterSecret = await this.encryptionHandler.decrypt(
        decodeBytes(encryptedUserKey.bytes, encryptedUserKey.encoding),
        encryptionKey
      );

      console.log('Master secret', masterSecret);
      this.verifyHash(new Uint8Array(masterSecret), userKeyHash);
      return masterSecret;
    } catch (error) {
      console.error('Error decrypting master secret', error);
      throw error;
    }
  }

  private async verifyHash(userKey: Uint8Array, userKeyHash: UserMasterSecretHash) {
    const hash = await crypto.subtle.digest(userKeyHash.algorithm, userKey);
    const reconstructedUserKeyHash = encodeBytes(new Uint8Array(hash), userKeyHash.encoding);
    if (reconstructedUserKeyHash !== userKeyHash.bytes) {
      throw new Error('User key hash does not match');
    }
    console.log('User key hash verified');
  }

  private async getEncryptionKey(teePublicKey: string): Promise<CryptoKey> {
    const keyPair = await this.keyProvider.getKeyPair();
    const publicKey = await new PublicKeyDeserializer().deserialize(teePublicKey);
    const encryptionKey = await deriveSymmetricKey(keyPair.privateKey, publicKey);
    return encryptionKey;
  }
}
