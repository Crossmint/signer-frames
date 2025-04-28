/**
 * XMIF - Main Framework Entry Point
 */

import { initializeHandlers, createXMIFServices } from './services';
import type { EventHandler } from './services/handlers';

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
    private readonly services = createXMIFServices(),
    private readonly handlers = initializeHandlers(services) as EventHandler[]
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
