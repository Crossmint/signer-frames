import { CrossmintApiService } from './api';
import { EventsService } from './communications/events';
import { AttestationService } from './tee/attestation';
import { EncryptionService } from './encryption';
import { Ed25519Service } from './crypto/algorithms/ed25519';
import { ShardingService } from './user/sharding';
import type { CrossmintFrameService } from './service';
import { FPEService } from './encryption/fpe';
import { Secp256k1Service } from './crypto/algorithms/secp256k1';
import { CryptoKeyService } from './crypto/crypto-key';
import { AuthShareCache } from './storage/auth-share-cache';
import { DeviceService } from './user/device';
import { IndexedDBAdapter } from './storage';
import { EncryptionKeyProvider } from './encryption-keys/encryption-key-provider';
import { TEEKeyProvider } from './encryption-keys/tee-key-provider';
import { SymmetricEncryptionKeyProvider } from './encryption/lib/symmetric-encryption-key-provider';
import { UserKeyManager } from './user/key-manager';

/**
 * Services index - Export all services
 */
export { initializeHandlers } from './communications/handlers';
export { CrossmintFrameService } from './service';

export type CrossmintFrameServices = {
  events: EventsService;
  api: CrossmintApiService;
  sharding: ShardingService;
  encrypt: EncryptionService;
  attestation: AttestationService;
  ed25519: Ed25519Service;
  secp256k1: Secp256k1Service;
  fpe: FPEService;
  cryptoKey: CryptoKeyService;
  device: DeviceService;
  storage: IndexedDBAdapter;
  teeKey: TEEKeyProvider;
  keyRepository: EncryptionKeyProvider;
  userKeyManager: UserKeyManager;
};

const EXPECTED_PHALA_APP_ID = 'df4f0ec61f92a8eec754593da9ea9cd939985e9c';

export const createCrossmintFrameServices = () => {
  const eventsService = new EventsService();
  const ed25519Service = new Ed25519Service();
  const storageService = new IndexedDBAdapter();
  const keyRepository = new EncryptionKeyProvider(storageService);
  const teeKeyService = new TEEKeyProvider();
  const encryptionService = new EncryptionService(keyRepository, teeKeyService);
  const secp256k1Service = new Secp256k1Service();
  const crossmintApiService = new CrossmintApiService(encryptionService);
  const deviceService = new DeviceService();
  const shardingService = new ShardingService(
    new AuthShareCache(crossmintApiService),
    deviceService,
    storageService
  );
  const fpeService = new FPEService(
    new SymmetricEncryptionKeyProvider(keyRepository, teeKeyService)
  );
  const cryptoKeyService = new CryptoKeyService(ed25519Service, secp256k1Service);
  const attestationService = new AttestationService(crossmintApiService, EXPECTED_PHALA_APP_ID);
  const userKeyManager = new UserKeyManager(keyRepository);
  teeKeyService.setAttestationService(attestationService);

  const services = {
    storage: storageService,
    keyRepository: keyRepository,
    events: eventsService,
    attestation: attestationService,
    teeKey: teeKeyService,
    ed25519: ed25519Service,
    secp256k1: secp256k1Service,
    encrypt: encryptionService,
    api: crossmintApiService,
    sharding: shardingService,
    fpe: fpeService,
    cryptoKey: cryptoKeyService,
    device: deviceService,
    userKeyManager: userKeyManager,
  } satisfies Record<string, CrossmintFrameService>;
  return services;
};
