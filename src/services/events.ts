import { HandshakeChild, type HandshakeOptions } from '@crossmint/client-sdk-window';
import { signerInboundEvents, signerOutboundEvents } from '@crossmint/client-signers';

const EVENT_VERSION = 1;

export class EventsService {
  private static messenger: HandshakeChild<
    typeof signerInboundEvents,
    typeof signerOutboundEvents
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
      incomingEvents: signerInboundEvents,
      outgoingEvents: signerOutboundEvents,
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
}
