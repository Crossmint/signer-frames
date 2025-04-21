import { HandshakeChild } from "@crossmint/client-sdk-window";
import {
  SecureSignerInboundEvents,
  SecureSignerOutboundEvents,
} from "@crossmint/client-signers";

const EVENT_VERSION = 1;

export class EventsService {
  private messenger: HandshakeChild<
    typeof SecureSignerInboundEvents,
    typeof SecureSignerOutboundEvents
  > | null = null;

  async init() {
    this.messenger = new HandshakeChild(window.parent, "*", {
      incomingEvents: SecureSignerInboundEvents,
      outgoingEvents: SecureSignerOutboundEvents,
    });
    await this.messenger.handshakeWithParent();
  }

  registerEventHandlers() {
    this.assertMessengerInitialized();
    const messenger = this.messenger as NonNullable<typeof this.messenger>;

    messenger.on("request:create-signer", async (data) => {
      console.log("Received create-signer request:", data);
      this.assertCorrectEventVersion(data);
      throw new Error("Not implemented");
    });
    messenger.on("request:get-attestation", async (data) => {
      console.log("Received get-attestation request:", data);
      this.assertCorrectEventVersion(data);
      throw new Error("Not implemented");
    });
    messenger.on("request:sign-message", async (data) => {
      console.log("Received sign-message request:", data);
      this.assertCorrectEventVersion(data);
      throw new Error("Not implemented");
    });
    messenger.on("request:sign-transaction", async (data) => {
      console.log("Received sign-transaction request:", data);
      this.assertCorrectEventVersion(data);
      throw new Error("Not implemented");
    });
    messenger.on("request:send-otp", async (data) => {
      console.log("Received send-otp request:", data);
      this.assertCorrectEventVersion(data);
      throw new Error("Not implemented");
    });
  }

  private assertMessengerInitialized() {
    if (!this.messenger) {
      throw new Error("Messenger not initialized");
    }
    if (!this.messenger.isConnected) {
      throw new Error("Messenger not connected");
    }
  }

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
