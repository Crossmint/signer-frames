/**
 * XMIF - Main Framework Entry Point
 */

import { initializeHandlers, createXMIFServices } from './services';
import type { EventHandler } from './services/handlers';
import type { Environment } from './services/api';

// Define window augmentation
declare global {
  interface Window {
    XMIF: XMIF;
    ENVIRONMENT: string;
  }
}

function parseEnvironment(environment: string): Environment {
  switch (environment.toLocaleLowerCase()) {
    case 'production':
      return 'production';
    case 'staging':
    case '{{XM_ENVIRONMENT}}': // Default to staging if not set
      return 'staging';
    case 'development':
    case 'dev':
      return 'development';
    default:
      throw new Error(`Invalid environment: ${environment}`);
  }
}

/**
 * Main XMIF class
 */
class XMIF {
  constructor(
    environment: 'production' | 'staging' | 'development' = parseEnvironment(
      window?.ENVIRONMENT ?? 'staging'
    ),
    private readonly services = createXMIFServices({
      environment,
    }),
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
