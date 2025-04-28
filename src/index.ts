/**
 * XMIF - Main Framework Entry Point
 */

import { EventsService, CrossmintApiService } from './services';
import { ShardingService } from './services/sharding-service';
import {
  CreateSignerEventHandler,
  type EventHandler,
  GetPublicKeyEventHandler,
  SendOtpEventHandler,
  SignEventHandler,
  SignMessageEventHandler,
  SignTransactionEventHandler,
} from './services/handlers';
import { SolanaService } from './services/solana';
import { EncryptionService } from './services/encryption';
import { AttestationService } from './services/attestation';
import { Ed25519Service } from './services/ed25519';
import type { XMIFService } from './services';

// Define window augmentation
declare global {
  interface Window {
    XMIF: XMIF;
  }
}

/**
 * Main XMIF class
 */
class XMIF {
  constructor(
    eventsService = new EventsService(),
    crossmintApiService = new CrossmintApiService(),
    ed25519Service = new Ed25519Service(),
    shardingService = new ShardingService(),
    solanaService = new SolanaService(ed25519Service),
    encryptionService = new EncryptionService(),
    attestationService = new AttestationService(),
    private services = {
      events: eventsService,
      api: crossmintApiService,
      ed25519: ed25519Service,
      sharding: shardingService,
      solana: solanaService,
      encrypt: encryptionService,
      attestation: attestationService,
    } satisfies Record<string, XMIFService>,
    private readonly handlers = [
      new CreateSignerEventHandler(services),
      new SendOtpEventHandler(services),
      new GetPublicKeyEventHandler(services),
      new SignMessageEventHandler(services),
      new SignTransactionEventHandler(services),
      new SignEventHandler(services),
    ]
  ) {}

  /**
   * Initialize the XMIF framework
   * @returns {Promise<XMIF>} This instance for chaining
   */
  async init(): Promise<void> {
    console.log('Initializing XMIF framework...');
    for (const service of Object.values(this.services)) {
      const serviceName = service.name;
      console.log(`-- Initializing ${serviceName}`);
      await service.init();
      console.log(`-- ${serviceName} initialized!`);
    }
    console.log('-- Registering event handlers');
    this.registerHandlers();
    console.log('-- Event handlers properly registered');
  }

  private registerHandlers() {
    const messenger = this.services.events.getMessenger();
    for (const handler of this.handlers) {
      console.log(`   -- Registering handler for event ${handler.event}`);
      messenger.on(handler.event, async payload => {
        // @ts-expect-error The payload types from different handlers are incompatible
        // but at runtime each handler only receives payloads it can handle
        const response = await handler.callback(payload);
        messenger.send(handler.responseEvent, response);
      });
      console.log(`  -- Handler for event ${handler.event} successfully registered`);
    }
  }
}

// Initialize when loaded as IIFE
if (typeof window !== 'undefined') {
  const xmifInstance = new XMIF();
  window.XMIF = xmifInstance;
}

// Export the XMIF class for direct usage
export default XMIF;
