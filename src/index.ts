/**
 * Crossmint Signers Frame - Main Framework Entry Point
 */

import { initializeHandlers, createCrossmintFrameServices } from './services';
import type { EventHandler } from './services/communications/handlers';
import { measureFunctionTime } from './services/encryption/lib/utils';

// Define window augmentation
declare global {
  interface Window {
    CrossmintFrame: CrossmintFrame;
    crossmintAppId?: string;
  }
}

/**
 * Main Crossmint Signers Frame class
 */
class CrossmintFrame {
  private static instance: CrossmintFrame | null = null;
  private static initializationPromise: Promise<CrossmintFrame> | null = null;
  private constructor(
    private readonly services = createCrossmintFrameServices(),
    private readonly handlers = initializeHandlers(services) as EventHandler[]
  ) {}

  /**
   * Get the singleton instance of Crossmint Signers Frame
   * @returns {Promise<CrossmintFrame>} The singleton instance
   */
  static async getInstance(): Promise<CrossmintFrame> {
    if (CrossmintFrame.instance) {
      return CrossmintFrame.instance;
    }

    if (!CrossmintFrame.initializationPromise) {
      CrossmintFrame.initializationPromise = (async () => {
        const instance = new CrossmintFrame();
        CrossmintFrame.instance = instance;
        return instance;
      })();
    }

    return CrossmintFrame.initializationPromise;
  }

  /**
   * Initialize the Crossmint Signers Frame framework
   * @returns {Promise<CrossmintFrame>} This instance for chaining
   */
  async init(): Promise<void> {
    console.log('Initializing Crossmint Signers Frame framework...');

    for (const service of Object.values(this.services)) {
      const serviceName = service.name;
      console.log(`-- Initializing ${serviceName}`);
      await measureFunctionTime(`[${serviceName} init]`, () => service.init());
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
  CrossmintFrame.getInstance().then(crossmintFrameInstance => {
    window.CrossmintFrame = crossmintFrameInstance;
  });
}

// Export the CrossmintFrame class for direct usage
export default CrossmintFrame;
