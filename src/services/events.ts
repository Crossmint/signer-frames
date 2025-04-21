import {
  HandshakeChild,
  type HandshakeOptions,
} from "@crossmint/client-sdk-window";
import {
  SecureSignerInboundEvents,
  SecureSignerOutboundEvents,
} from "@crossmint/client-signers";
import type { z } from "zod";

const EVENT_VERSION = 1;

type IncomingEvents = typeof SecureSignerInboundEvents;
type OutgoingEvents = typeof SecureSignerOutboundEvents;
type IncomingEventName = keyof IncomingEvents;
type OutgoingEventName = keyof OutgoingEvents;
type IncomingEventData<K extends IncomingEventName> = z.infer<
  IncomingEvents[K]
>;
type OutgoingEventData<K extends OutgoingEventName> = z.infer<
  OutgoingEvents[K]
>;

export class EventsService {
  private static messenger: HandshakeChild<
    IncomingEvents,
    OutgoingEvents
  > | null = null;

  /**
   * Initialize the messenger and register event handlers
   * The messenger is shared across all instances
   */
  async initMessenger(options?: {
    handshakeOptions?: HandshakeOptions;
    targetOrigin?: string;
  }): Promise<void> {
    if (EventsService.messenger) {
      console.log("Messenger already initialized");
      return;
    }

    EventsService.messenger = new HandshakeChild(window.parent, "*", {
      incomingEvents: SecureSignerInboundEvents,
      outgoingEvents: SecureSignerOutboundEvents,
      handshakeOptions: options?.handshakeOptions,
      targetOrigin: options?.targetOrigin,
    });

    await EventsService.messenger.handshakeWithParent();
  }

  /**
   * Register a single event handler with proper typing
   * @param event The event name to listen for
   * @param handler The handler function with correct parameter and return types
   * @returns Handler ID
   */
  registerHandler<K extends IncomingEventName>(
    event: K,
    handler: (
      data: IncomingEventData<K>
    ) => Promise<
      OutgoingEventData<`response:${K extends `request:${infer R}`
        ? R
        : never}`>
    >
  ): string {
    this.assertMessengerInitialized();
    const messenger = EventsService.messenger as NonNullable<
      typeof EventsService.messenger
    >;
    return messenger.on(event, handler);
  }

  /**
   * Assert that the messenger is initialized and connected
   */
  private assertMessengerInitialized(): void {
    if (!EventsService.messenger) {
      throw new Error("Messenger not initialized");
    }
    if (!EventsService.messenger.isConnected) {
      throw new Error("Messenger not connected");
    }
  }

  /**
   * Get the messenger instance
   */
  getMessenger(): NonNullable<typeof EventsService.messenger> {
    this.assertMessengerInitialized();
    return EventsService.messenger as NonNullable<
      typeof EventsService.messenger
    >;
  }

  /**
   * Assert that an event has the correct version
   */
  private assertCorrectEventVersion<T extends { version: number }>(
    data: T
  ): asserts data is T & { version: typeof EVENT_VERSION } {
    if (data.version !== EVENT_VERSION) {
      throw new Error(
        `Invalid event version. Expected ${EVENT_VERSION}, got ${data.version}`
      );
    }
  }
}
