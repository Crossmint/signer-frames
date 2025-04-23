/**
 * XMIF - Main Framework Entry Point
 */

import { EventsService, StorageService, CrossmintApiService } from './services';
import type { StorageItem, Stores } from './services/storage';
import { ShardingService } from './services/sharding-service';
import {
  CreateSignerEventHandler,
  GetPublicKeyEventHandler,
  SendOtpEventHandler,
  SignMessageEventHandler,
  SignTransactionEventHandler,
} from './services/handlers';

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
  // Services
  constructor(
    private readonly eventsService = new EventsService(),
    private readonly storageService = new StorageService(),
    private readonly crossmintApiService = new CrossmintApiService(),
    private readonly shardingService = new ShardingService(storageService, crossmintApiService),
    private readonly handlers = [
      new CreateSignerEventHandler(crossmintApiService),
      new SendOtpEventHandler(crossmintApiService, shardingService),
      new GetPublicKeyEventHandler(crossmintApiService, shardingService),
      new SignMessageEventHandler(),
      new SignTransactionEventHandler(),
    ]
  ) {}

  /**
   * Initialize the XMIF framework
   * @returns {Promise<XMIF>} This instance for chaining
   */
  async init(): Promise<void> {
    console.log('Initializing XMIF framework...');

    console.log('-- Initializing IndexedDB client...');
    await this.storageService.initDatabase();
    console.log('-- IndexedDB client initialized!');

    console.log('-- Initializing Crossmint API...');
    await this.crossmintApiService.init();
    console.log('-- Crossmint API initialized!');

    console.log('-- Initializing events handlers...');
    await this.eventsService.initMessenger();
    this.registerHandlers();
    console.log('-- Events handlers initialized!');
  }

  /**
   * Get all items from a specified store
   * @param {Stores} storeName - The name of the object store
   * @returns {Promise<StorageItem[]>} A promise that resolves to an array of items
   */
  async listItems(storeName: Stores): Promise<StorageItem[]> {
    return this.storageService.listItems(storeName);
  }

  /**
   * Get a specific item from a store
   * @param {Stores} storeName - The name of the object store
   * @param {string} id - The ID of the item to retrieve
   * @returns {Promise<StorageItem | null>} A promise that resolves to the item or null
   */
  async getItem(storeName: Stores, id: string): Promise<StorageItem | null> {
    return this.storageService.getItem(storeName, id);
  }

  private registerHandlers() {
    const messenger = this.eventsService.getMessenger();
    for (const handler of this.handlers) {
      messenger.on(handler.event, async payload => {
        // @ts-expect-error The payload types from different handlers are incompatible
        // but at runtime each handler only receives payloads it can handle
        const response = await handler.handler(payload);
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
