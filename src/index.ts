/**
 * XMIF - Main Framework Entry Point
 */

import {
  EventService,
  StorageService,
  CrossmintApiService,
} from "./services/index.js";
import {
  EventName,
  EventInput,
  EventOutput,
  EventHandler,
  EventHandlerResult,
} from "./services/events.js";

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
    private readonly eventService = new EventService(),
    private readonly storageService = new StorageService(),
    private readonly crossmintApiService = new CrossmintApiService()
  ) {}

  /**
   * Initialize the XMIF framework
   * @returns {Promise<XMIF>} This instance for chaining
   */
  init(): XMIF {
    // Initialize core event listeners
    this.setupCoreEventHandlers();
    return this;
  }

  /**
   * Set up core event handlers for the framework
   * @private
   */
  private setupCoreEventHandlers(): void {
    // Register system events
    this.on("system:ready", "core", {
      handle: async () => ({
        success: true,
        data: { initialized: true, timestamp: Date.now() },
      }),
    });

    // Additional core event handlers can be added here
  }

  /**
   * Register an event handler
   * @param eventName The name of the event to handle
   * @param handlerId Unique identifier for this handler
   * @param handler The event handler implementation
   */
  public on<T extends EventName>(
    eventName: T,
    handlerId: string,
    handler: EventHandler<T>
  ): XMIF {
    this.eventService.registerEventHandler(eventName, handlerId, handler);
    return this;
  }

  /**
   * Remove an event handler
   * @param eventName The name of the event
   * @param handlerId The handler ID to remove
   */
  public off(eventName: EventName, handlerId: string): XMIF {
    this.eventService.unregisterEventHandler(eventName, handlerId);
    return this;
  }

  /**
   * Trigger an event
   * @param eventName The name of the event to trigger
   * @param data The data to pass to the event handlers
   * @returns Result from the event handlers
   */
  public async emit<T extends EventName>(
    eventName: T,
    data: EventInput<T>
  ): Promise<EventHandlerResult<T> | null> {
    return this.eventService.handleEvent(eventName, data);
  }

  /**
   * Check if an event has handlers
   * @param eventName The name of the event to check
   * @param handlerId Optional specific handler ID to check
   * @returns True if the event has handlers
   */
  public hasEventHandler(eventName: EventName, handlerId?: string): boolean {
    return this.eventService.hasEventHandler(eventName, handlerId);
  }
}

// Initialize when loaded as IIFE
if (typeof window !== "undefined") {
  const xmifInstance = new XMIF().init();
  window.XMIF = xmifInstance;
  console.log("XMIF framework initialized!");

  // Emit system ready event
  xmifInstance.emit("system:ready", {}).then((result) => {
    if (result?.success) {
      console.log("System ready event processed successfully");
    }
  });
}

// Export the XMIF class for direct usage
export default XMIF;
export { EventName, EventInput, EventOutput, EventHandler, EventHandlerResult };
