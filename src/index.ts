/**
 * XMIF - Main Framework Entry Point
 */

import { initializeHandlers, createXMIFServices } from './services';
import type { EventHandler } from './services/handlers';

// Define window augmentation
declare global {
  interface Window {
    XMIF: XMIF;
    crossmintAppId?: string;
  }
}

/**
 * Main XMIF class
 */
class XMIF {
  private static instance: XMIF | null = null;
  private static initializationPromise: Promise<XMIF> | null = null;
  constructor(
    private readonly services = createXMIFServices(),
    private readonly handlers = initializeHandlers(services) as EventHandler[]
  ) {}

  /**
   * Get the singleton instance of XMIF
   * @returns {Promise<XMIF>} The singleton instance
   */
  static async getInstance(): Promise<XMIF> {
    if (XMIF.instance) {
      return XMIF.instance;
    }

    if (!XMIF.initializationPromise) {
      XMIF.initializationPromise = (async () => {
        const instance = new XMIF();
        XMIF.instance = instance;
        return instance;
      })();
    }

    return XMIF.initializationPromise;
  }

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
        const response = await handler.callback(payload);
        messenger.send(handler.responseEvent, response);
      });
      console.log(`  -- Handler for event ${handler.event} successfully registered`);
    }
  }
}

// Initialize when loaded as IIFE
if (typeof window !== 'undefined') {
  XMIF.getInstance().then(xmifInstance => {
    window.XMIF = xmifInstance;
  });
}

// Export the XMIF class for direct usage
export default XMIF;
