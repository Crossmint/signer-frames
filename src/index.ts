/**
 * XMIF - Main Framework Entry Point
 */

import {
  EventsService,
  StorageService,
  CrossmintApiService,
} from "./services/index.js";
import type {
  SecureSignerInboundEvents,
  SecureSignerOutboundEvents,
} from "@crossmint/client-signers";
import type { z } from "zod";

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
    await this.eventsService.initMessenger();
    console.log("-- Events handlers initialized!");
  }

  private registerHandlers() {
    const messenger = this.eventsService.getMessenger();
    messenger.on("request:create-signer", async (data) => {
      console.log("Received create-signer request:", data);
      throw new Error("Not implemented");
    });
    messenger.on("request:get-attestation", async (data) => {
      console.log("Received get-attestation request:", data);
      throw new Error("Not implemented");
    });
    messenger.on("request:sign-message", async (data) => {
      console.log("Received sign-message request:", data);
      throw new Error("Not implemented");
    });
    messenger.on("request:sign-transaction", async (data) => {
      console.log("Received sign-transaction request:", data);
      throw new Error("Not implemented");
    });
    messenger.on("request:send-otp", async (data) => {
      console.log("Received send-otp request:", data);
      throw new Error("Not implemented");
    });
  }
}

// Initialize when loaded as IIFE
if (typeof window !== "undefined") {
  const xmifInstance = new XMIF();
  window.XMIF = xmifInstance;
}

// Export the XMIF class for direct usage
export default XMIF;
