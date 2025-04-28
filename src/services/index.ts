import type { CrossmintApiService } from './api';
import type { EventsService } from './events';
import type { ShardingService } from './sharding-service';
import type { AttestationService } from './attestation';
import type { EncryptionService } from './encryption';
import type { SolanaService } from './solana';
import type { Ed25519Service } from './ed25519';

/**
 * Services index - Export all services
 */
export { EventsService } from './events';
export { CrossmintApiService } from './api';
export { ShardingService } from './sharding-service';
export { EncryptionService } from './encryption';
export { AttestationService } from './attestation';
export { Ed25519Service } from './ed25519';
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
