import {
  ChildWindow,
  type HandshakeChild,
  type HandshakeOptions,
  RNWebViewChild,
} from '@crossmint/client-sdk-window';
import { signerInboundEvents, signerOutboundEvents } from '@crossmint/client-signers';

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

    EventsService.messenger =
      'ReactNativeWebView' in window && window.ReactNativeWebView != null
        ? new RNWebViewChild({
            incomingEvents: signerInboundEvents,
            outgoingEvents: signerOutboundEvents,
          })
        : new ChildWindow(window.parent, options?.targetOrigin ?? '*', {
            incomingEvents: signerInboundEvents,
            outgoingEvents: signerOutboundEvents,
            handshakeOptions: options?.handshakeOptions,
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
