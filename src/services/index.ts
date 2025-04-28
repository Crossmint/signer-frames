import { CrossmintApiService } from './api';
import { EventsService } from './events';
import { AttestationService } from './attestation';
import { EncryptionService } from './encryption';
import { SolanaService } from './solana';
import { Ed25519Service } from './ed25519';
import { ShardingService } from './sharding';
import type { XMIFService } from './service';

/**
 * Services index - Export all services
 */
export { initializeHandlers } from './handlers';
export type { XMIFService } from './service';

export type XMIFServices = {
  events: EventsService;
  api: CrossmintApiService;
  sharding: ShardingService;
  encrypt: EncryptionService;
  attestation: AttestationService;
  solana: SolanaService;
  ed25519: Ed25519Service;
};

export const createXMIFServices = () => {
  const eventsService = new EventsService();
  const attestationService = new AttestationService();
  const ed25519Service = new Ed25519Service();
  const solanaService = new SolanaService(ed25519Service);
  const shardingService = new ShardingService();
  const encryptionService = new EncryptionService(attestationService);
  const crossmintApiService = new CrossmintApiService(encryptionService);
  const services = {
    events: eventsService,
    attestation: attestationService,
    ed25519: ed25519Service,
    solana: solanaService,
    sharding: shardingService,
    encrypt: encryptionService,
    api: crossmintApiService,
  } satisfies Record<string, XMIFService>;
  return services;
};
