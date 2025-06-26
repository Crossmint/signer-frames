import { CrossmintApiService } from './api';
import { EventsService } from './communications/events';
import { AttestationService } from './tee/attestation';
import { EncryptionService } from './encryption';
import { Ed25519Service } from './crypto/algorithms/ed25519';
import type { CrossmintFrameService } from './service';
import { FPEService } from './encryption/lib/encryption/symmetric/fpe/fpe';
import { Secp256k1Service } from './crypto/algorithms/secp256k1';
import { CryptoKeyService } from './crypto/crypto-key';
import { DeviceService } from './user/device';
import { IndexedDBAdapter } from './storage';
import { EncryptionKeyProvider } from './encryption-keys/encryption-key-provider';
import { TEEKeyProvider } from './encryption-keys/tee-key-provider';
import { SymmetricEncryptionKeyDerivator } from './encryption/lib/key-management/symmetric-key-derivator';
import { UserKeyManager } from './user/key-manager';
import { InMemoryCacheService } from './storage/cache';

/**
 * Services index - Export all services
 */
export { initializeHandlers } from './communications/handlers';
export { CrossmintFrameService } from './service';

export type CrossmintFrameServices = {
  events: EventsService;
  api: CrossmintApiService;
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
  cache: InMemoryCacheService;
};

const EXPECTED_PHALA_APP_ID = 'df4f0ec61f92a8eec754593da9ea9cd939985e9c';

export const createCrossmintFrameServices = () => {
  const eventsService = new EventsService();
  const ed25519Service = new Ed25519Service();
  const cacheService = new InMemoryCacheService();
  const storageService = new IndexedDBAdapter();
  const keyRepository = new EncryptionKeyProvider(storageService);
  const teeKeyService = new TEEKeyProvider();
  const encryptionService = new EncryptionService(keyRepository, teeKeyService);
  const secp256k1Service = new Secp256k1Service();
  const crossmintApiService = new CrossmintApiService(encryptionService);
  const deviceService = new DeviceService();
  const fpeService = new FPEService(
    new SymmetricEncryptionKeyDerivator(keyRepository, teeKeyService)
  );
  const cryptoKeyService = new CryptoKeyService(ed25519Service, secp256k1Service);
  const attestationService = new AttestationService(crossmintApiService, EXPECTED_PHALA_APP_ID);
  const userKeyManager = new UserKeyManager(
    crossmintApiService,
    keyRepository,
    deviceService,
    cacheService
  );
  teeKeyService.setAttestationService(attestationService);

  const services = {
    cache: cacheService,
    storage: storageService,
    keyRepository: keyRepository,
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
