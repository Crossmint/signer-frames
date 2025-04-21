/**
 * XMIF - Main Framework Entry Point
 */

import {
  EventsService,
  StorageService,
  CrossmintApiService,
} from "./services/index.js";

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
    private readonly crossmintApiService = new CrossmintApiService()
  ) {}

  /**
   * Initialize the XMIF framework
   * @returns {Promise<XMIF>} This instance for chaining
   */
  async init(): Promise<void> {
    console.log("Initializing XMIF framework...");
    console.log("-- Initializing IndexedDB...");
    await this.storageService.initDatabase();
    console.log("-- IndexedDB initialized!");
    console.log("-- Initializing events handlers...");
    await this.eventsService.init();
    console.log("-- Events handlers initialized!");
  }
}

// Initialize when loaded as IIFE
if (typeof window !== "undefined") {
  const xmifInstance = new XMIF();
  window.XMIF = xmifInstance;
}

// Export the XMIF class for direct usage
export default XMIF;
