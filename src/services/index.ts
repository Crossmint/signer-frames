import { CrossmintApiService } from './api';
import { EventsService } from './communications/events';
import { AttestationService } from './tee/attestation';
import { HPKEService } from './encryption/hpke';
import { Ed25519Service } from './crypto/algorithms/ed25519';
import type { CrossmintFrameService } from './service';
import { Secp256k1Service } from './crypto/algorithms/secp256k1';
import { CryptoKeyService } from './crypto/crypto-key';
import { DeviceService } from './user/device';
import { IndexedDBAdapter } from './storage';
import { MasterFrameKeyProvider } from './encryption-keys/encryption-key-provider';
import { TEEKeyProvider } from './encryption-keys/tee-key-provider';
import { UserMasterSecretManager } from './user/key-manager';
import { InMemoryCacheService } from './storage/cache';
import { FPEService } from './encryption/fpe';

/**
 * Services index - Export all services
 */
export { initializeHandlers } from './communications/handlers';
export { CrossmintFrameService } from './service';

export type CrossmintFrameServices = {
  events: EventsService;
  api: CrossmintApiService;
  encrypt: HPKEService;
  attestation: AttestationService;
  ed25519: Ed25519Service;
  secp256k1: Secp256k1Service;
  fpe: FPEService;
  cryptoKey: CryptoKeyService;
  device: DeviceService;
  storage: IndexedDBAdapter;
  teeKey: TEEKeyProvider;
  encryptionKeyProvider: MasterFrameKeyProvider;
  userKeyManager: UserMasterSecretManager;
  cache: InMemoryCacheService;
};

const EXPECTED_PHALA_APP_ID = 'df4f0ec61f92a8eec754593da9ea9cd939985e9c';

export const createCrossmintFrameServices = () => {
  const eventsService = new EventsService();
  const ed25519Service = new Ed25519Service();
  const cacheService = new InMemoryCacheService();
  const storageService = new IndexedDBAdapter();
  const encryptionKeyProvider = new MasterFrameKeyProvider(storageService);
  const teeKeyService = new TEEKeyProvider();
  const encryptionService = new HPKEService(encryptionKeyProvider, teeKeyService);
  const secp256k1Service = new Secp256k1Service();
  const crossmintApiService = new CrossmintApiService(encryptionService);
  const deviceService = new DeviceService();
  const fpeService = new FPEService(encryptionKeyProvider, teeKeyService);
  const cryptoKeyService = new CryptoKeyService(ed25519Service, secp256k1Service);
  const attestationService = new AttestationService(crossmintApiService, EXPECTED_PHALA_APP_ID);
  const userKeyManager = new UserMasterSecretManager(
    crossmintApiService,
    encryptionKeyProvider,
    deviceService,
    cacheService
  );
  teeKeyService.setAttestationService(attestationService);

  const services = {
    cache: cacheService,
    storage: storageService,
    encryptionKeyProvider: encryptionKeyProvider,
    events: eventsService,
    attestation: attestationService,
    teeKey: teeKeyService,
    ed25519: ed25519Service,
    secp256k1: secp256k1Service,
    encrypt: encryptionService,
    api: crossmintApiService,
    fpe: fpeService,
    cryptoKey: cryptoKeyService,
    device: deviceService,
    userKeyManager: userKeyManager,
  } satisfies Record<string, CrossmintFrameService>;
  return services;
};
