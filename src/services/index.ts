import { CrossmintApiService } from './api';
import { EventsService } from './events';
import { AttestationService } from './attestation';
import { EncryptionService } from './encryption';
import { Ed25519Service } from './ed25519';
import { ShardingService } from './sharding';
import type { XMIFService } from './service';
import { FPEService } from './fpe';

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
  fpe: FPEService;
};

export const createXMIFServices = () => {
  const eventsService = new EventsService();
  const ed25519Service = new Ed25519Service();
  const encryptionService = new EncryptionService();
  const crossmintApiService = new CrossmintApiService(encryptionService);
  const attestationService = new AttestationService(crossmintApiService);
  const shardingService = new ShardingService(crossmintApiService);
  const fpeService = new FPEService(encryptionService);

  encryptionService.setAttestationService(attestationService);

  const services = {
    events: eventsService,
    attestation: attestationService,
    ed25519: ed25519Service,
    encrypt: encryptionService,
    api: crossmintApiService,
    sharding: shardingService,
    fpe: fpeService,
  } satisfies Record<string, XMIFService>;
  return services;
};
