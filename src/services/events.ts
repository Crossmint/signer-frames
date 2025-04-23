import { HandshakeChild, type HandshakeOptions } from '@crossmint/client-sdk-window';
import {
  type SecureSignerInboundEvents,
  type SecureSignerOutboundEvents,
  secureSignerInboundEvents,
  secureSignerOutboundEvents,
} from '@crossmint/client-signers';
import type { z } from 'zod';

const EVENT_VERSION = 1;

export class EventsService {
  private static messenger: HandshakeChild<
    SecureSignerInboundEvents,
    SecureSignerOutboundEvents
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
      console.log('Messenger already initialized');
      return;
    }

    EventsService.messenger = new HandshakeChild(window.parent, '*', {
      incomingEvents: secureSignerInboundEvents,
      outgoingEvents: secureSignerOutboundEvents,
      handshakeOptions: options?.handshakeOptions,
      targetOrigin: options?.targetOrigin,
    });

    await EventsService.messenger.handshakeWithParent();
  }

  /**
   * Assert that the messenger is initialized and connected
   */
  private assertMessengerInitialized(): void {
    if (!EventsService.messenger) {
      throw new Error('Messenger not initialized');
    }
    if (!EventsService.messenger.isConnected) {
      throw new Error('Messenger not connected');
    }
  }

  /**
   * Get the messenger instance
   */
  getMessenger(): NonNullable<typeof EventsService.messenger> {
    this.assertMessengerInitialized();
    return EventsService.messenger as NonNullable<typeof EventsService.messenger>;
  }

  /**
   * Assert that an event has the correct version
   */
  private assertCorrectEventVersion<T extends { version: number }>(
    data: T
  ): asserts data is T & { version: typeof EVENT_VERSION } {
    if (data.version !== EVENT_VERSION) {
      throw new Error(`Invalid event version. Expected ${EVENT_VERSION}, got ${data.version}`);
    }
  }
}
