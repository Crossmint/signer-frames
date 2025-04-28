import { CrossmintApiService } from './api';
import { EventsService } from './events';
import { ShardingService } from './sharding-service';
import { AttestationService } from './attestation';
import { EncryptionService } from './encryption';
import { SolanaService } from './solana';
import { Ed25519Service } from './ed25519';
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
  const crossmintApiService = new CrossmintApiService();
  const ed25519Service = new Ed25519Service();
  const shardingService = new ShardingService();
  const solanaService = new SolanaService(ed25519Service);
  const encryptionService = new EncryptionService();
  const attestationService = new AttestationService();
  const services = {
    events: eventsService,
    api: crossmintApiService,
    ed25519: ed25519Service,
    sharding: shardingService,
    solana: solanaService,
    encrypt: encryptionService,
    attestation: attestationService,
  } satisfies Record<string, XMIFService>;
  return services;
};
