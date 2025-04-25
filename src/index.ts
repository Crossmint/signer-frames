/**
 * XMIF - Main Framework Entry Point
 */

import { EventsService, CrossmintApiService } from './services';
import { ShardingService } from './services/sharding-service';
import {
  CreateSignerEventHandler,
  GetPublicKeyEventHandler,
  SendOtpEventHandler,
  SignMessageEventHandler,
  SignTransactionEventHandler,
} from './services/handlers';
import { Ed25519Service } from './services/ed25519';

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
    private readonly eventsService = new EventsService(),
    private readonly crossmintApiService = new CrossmintApiService(),
    readonly shardingService = new ShardingService(),
    readonly ed25519Service = new Ed25519Service(),
    private readonly handlers = [
      new CreateSignerEventHandler(crossmintApiService, shardingService),
      new SendOtpEventHandler(crossmintApiService, shardingService),
      new GetPublicKeyEventHandler(shardingService),
      new SignMessageEventHandler(shardingService, ed25519Service),
      new SignTransactionEventHandler(shardingService, ed25519Service),
    ]
  ) {}

  /**
   * Initialize the XMIF framework
   * @returns {Promise<XMIF>} This instance for chaining
   */
  async init(): Promise<void> {
    console.log('Initializing XMIF framework...');

    console.log('-- Initializing Crossmint API...');
    await this.crossmintApiService.init();
    console.log('-- Crossmint API initialized!');

    console.log('-- Initializing events handlers...');
    await this.eventsService.initMessenger();
    this.registerHandlers();
    console.log('-- Events handlers initialized!');
  }

  private registerHandlers() {
    const messenger = this.eventsService.getMessenger();
    for (const handler of this.handlers) {
      messenger.on(handler.event, async payload => {
        // @ts-expect-error The payload types from different handlers are incompatible
        // but at runtime each handler only receives payloads it can handle
        const response = await handler.callback(payload);
        messenger.send(handler.responseEvent, response);
      });
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
