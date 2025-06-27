import {
  ChildWindow,
  type HandshakeChild,
  type HandshakeOptions,
} from '@crossmint/client-sdk-window';
import { RNWebViewChild } from '@crossmint/client-sdk-rn-window';
import { signerInboundEvents, signerOutboundEvents } from '@crossmint/client-signers';
import { CrossmintFrameService } from '../service';

export class EventsService extends CrossmintFrameService {
  name = 'Events Service';
  log_prefix = '[EventsService]';
  private static messenger: HandshakeChild<
    typeof signerInboundEvents,
    typeof signerOutboundEvents
  > | null = null;

  /**
   * Initialize the messenger and register event handlers
   * The messenger is shared across all instances
   */
  async init(options?: {
    handshakeOptions?: HandshakeOptions;
    targetOrigin?: string;
  }): Promise<void> {
    if (EventsService.messenger) {
      this.log('Messenger already initialized');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const targetOrigin = urlParams.get('targetOrigin');

    // For debugging purposes, we can delete this later
    if (targetOrigin) {
      console.log('targetOrigin', targetOrigin);
    } else {
      console.log('targetOrigin not provided');
    }
 
    EventsService.messenger =
      'ReactNativeWebView' in window && window.ReactNativeWebView != null
        ? new RNWebViewChild({
            incomingEvents: signerInboundEvents,
            outgoingEvents: signerOutboundEvents,
          })
        : new ChildWindow(window.parent, targetOrigin ?? '*', {
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
