import { HandshakeChild } from "@crossmint/client-sdk-window";
import { ORIGIN } from "../consts";
import { z } from "zod";

const EVENT_NAMES = [
  "sign-message",
  "sign-transaction",
  "attestation",
  "get-public-key",
  "send-otp",
  "create-signer",
  "test",
] as const;
type EventName = (typeof EVENT_NAMES)[number];
type IncomingEventName = `request:${EventName}`;
type OutgoingEventName = `response:${EventName}`;

/* TMP */
// Define incoming events (events that the iframe sends o us)
export const incomingEvents: Record<IncomingEventName, z.ZodType> = {
  "request:sign-message": z.object({
    address: z.string(),
    signature: z.string(),
  }),
  "request:sign-transaction": z.object({
    transaction: z.string(), // Base58 serialized transaction
  }),
  "request:attestation": z.object({
    attestation: z.record(z.string(), z.any()),
  }),
  "request:get-public-key": z.object({
    publicKey: z.string(),
  }),
  "request:send-otp": z.object({
    success: z.boolean(),
  }),
  "request:create-signer": z.object({
    requestId: z.string(),
  }),
  "request:test": z.object({
    message: z.string(),
  }),
} as const;

// Define outgoing events (events that we send to the iframe)
// Still incomplete, should be extended
const AuthenticationDataSchema = z.object({
  address: z.string(),
  requestId: z.string(),
});
export const outgoingEvents: Record<OutgoingEventName, z.ZodType> = {
  "response:attestation": z.undefined(),
  "response:sign-message": AuthenticationDataSchema.extend({
    message: z.string(), // Base58 encoded message
  }),
  "response:sign-transaction": AuthenticationDataSchema.extend({
    transaction: z.string(), // Base58 serialized transaction
  }),
  "response:get-public-key": AuthenticationDataSchema,
  "response:send-otp": AuthenticationDataSchema.extend({
    otp: z.string(),
    requestId: z.string(),
  }),
  "response:create-signer": AuthenticationDataSchema.extend({
    authId: z.string(),
  }),
  "response:test": z.object({
    message: z.string(),
  }),
} as const;
/* End of TMP */

type EventHandlerMap = Record<
  EventName,
  (
    handler: z.infer<(typeof incomingEvents)[`request:${EventName}`]>
  ) => Promise<z.infer<(typeof outgoingEvents)[`response:${EventName}`]>>
>;

export class EventsService {
  private messenger: HandshakeChild<
    typeof incomingEvents,
    typeof outgoingEvents
  > | null = null;

  async init() {
    this.messenger = new HandshakeChild(window.parent, "*", {
      incomingEvents,
      outgoingEvents,
    });
    await this.messenger.handshakeWithParent();
  }

  registerEventHandlers(events: EventHandlerMap) {
    if (!this.messenger) {
      throw new Error("Messenger not initialized");
    }
    for (const event of EVENT_NAMES) {
      this.messenger.on(`request:${event}`, events[event]);
    }
  }

  registerEventHandler<T extends EventName>(
    eventName: T,
    handler: EventHandlerMap[T]
  ) {
    if (!this.messenger) {
      throw new Error("Messenger not initialized");
    }
    this.messenger.on(`request:${eventName}`, handler);
  }
}
