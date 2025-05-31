import { CrossmintApiService } from './api';
import { EventsService } from './events';
import { AttestationService } from './attestation';
import { EncryptionService } from './encryption';
import { Ed25519Service } from './ed25519';
import { ShardingService } from './sharding';
import type { XMIFService } from './service';
import { FPEService } from './fpe';
import { Secp256k1Service } from './secp256k1';
import { CryptoKeyService } from './crypto-key';
import { AuthShareCache } from './auth-share-cache';
import { DeviceService } from './device';

/**
 * Services index - Export all services
 */
export { initializeHandlers } from './handlers';
export { XMIFService } from './service';

export type XMIFServices = {
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
};

export const createXMIFServices = () => {
  const eventsService = new EventsService();
  const ed25519Service = new Ed25519Service();
  const encryptionService = new EncryptionService();
  const secp256k1Service = new Secp256k1Service();
  const crossmintApiService = new CrossmintApiService(encryptionService);
  const attestationService = new AttestationService(crossmintApiService);
  const deviceService = new DeviceService();
  const shardingService = new ShardingService(
    new AuthShareCache(crossmintApiService),
    deviceService
  );
  const fpeService = new FPEService(encryptionService);
  const cryptoKeyService = new CryptoKeyService(ed25519Service, secp256k1Service);

  encryptionService.setAttestationService(attestationService);

  const services = {
    events: eventsService,
    attestation: attestationService,
    ed25519: ed25519Service,
    secp256k1: secp256k1Service,
    encrypt: encryptionService,
    api: crossmintApiService,
    sharding: shardingService,
    fpe: fpeService,
    cryptoKey: cryptoKeyService,
    device: deviceService,
  } satisfies Record<string, XMIFService>;
  return services;
};
