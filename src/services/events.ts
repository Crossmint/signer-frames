/**
 * Event Service
 *
 * This event system provides type-safe event handling with input/output type inference:
 *
 * Usage examples:
 *
 * 1. Register a handler for a specific event:
 * ```
 * const eventService = new EventService();
 *
 * eventService.registerEventHandler("user:created", "user-notification", {
 *   handle: async (data) => {
 *     // data is typed as { id: string; email: string; name: string; }
 *     // ...
 *     return {
 *       success: true,
 *       data: { success: true, userId: data.id }
 *     };
 *   }
 * });
 * ```
 *
 * 2. Trigger an event:
 * ```
 * const result = await eventService.handleEvent("user:created", {
 *   id: "123",
 *   email: "user@example.com",
 *   name: "John Doe"
 * });
 * // result.data is typed as { success: boolean; userId: string; }
 * ```
 *
 * 3. Adding new event types:
 * Extend the EventMap interface to define new event types with their input/output types.
 */

export type EventName = string;

export interface EventMap {
  [key: string]: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  };

  // Example event definitions
  "user:created": {
    input: {
      id: string;
      email: string;
      name: string;
    };
    output: {
      success: boolean;
      userId: string;
    };
  };

  "payment:processed": {
    input: {
      orderId: string;
      amount: number;
      currency: string;
    };
    output: {
      transactionId: string;
      status: "succeeded" | "failed";
    };
  };

  // System events
  "system:ready": {
    input: Record<string, never>;
    output: {
      initialized: boolean;
      timestamp: number;
    };
  };

  "system:error": {
    input: {
      message: string;
      code?: string;
      details?: Record<string, unknown>;
    };
    output: {
      handled: boolean;
      timestamp: number;
    };
  };
}
// End Examples

export type EventInput<T extends EventName = EventName> =
  T extends keyof EventMap ? EventMap[T]["input"] : Record<string, unknown>;

export type EventOutput<T extends EventName = EventName> =
  T extends keyof EventMap ? EventMap[T]["output"] : Record<string, unknown>;

export type Events = Record<string, EventHandler<EventName>>;

export type EventHandlerResult<T extends EventName = EventName> =
  | {
      success: false;
      error: Error;
    }
  | {
      success: true;
      data: EventOutput<T>;
    };

export type EventHandler<T extends EventName = EventName> = {
  handle: (data: EventInput<T>) => Promise<EventHandlerResult<T>>;
};

export class EventService {
  private readonly eventHandlers: Record<EventName, Events> = {};

  public async handleEvent<T extends EventName = EventName>(
    eventName: T,
    data: EventInput<T>
  ): Promise<EventHandlerResult<T> | null> {
    const handlers = this.eventHandlers[eventName];

    if (!handlers) {
      return null;
    }

    const results: EventHandlerResult<T>[] = [];

    for (const handlerId in handlers) {
      const handler = handlers[handlerId] as EventHandler<T>;
      const result = await handler.handle(data);
      results.push(result as EventHandlerResult<T>);

      // If any handler fails, return the error immediately
      if (!result.success) {
        return result as EventHandlerResult<T>;
      }
    }

    // Return the last successful result or null if no handlers
    return results.length > 0 ? results[results.length - 1] : null;
  }

  public registerEventHandler<T extends EventName = EventName>(
    eventName: T,
    handlerId: string,
    handler: EventHandler<T>
  ): void {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = {};
    }

    this.eventHandlers[eventName][handlerId] = handler;
  }

  public unregisterEventHandler(eventName: EventName, handlerId: string): void {
    if (
      this.eventHandlers[eventName] &&
      handlerId in this.eventHandlers[eventName]
    ) {
      delete this.eventHandlers[eventName][handlerId];

      // Clean up empty event entries
      if (Object.keys(this.eventHandlers[eventName]).length === 0) {
        delete this.eventHandlers[eventName];
      }
    }
  }

  public hasEventHandler(eventName: EventName, handlerId?: string): boolean {
    if (!this.eventHandlers[eventName]) {
      return false;
    }

    if (handlerId) {
      return handlerId in this.eventHandlers[eventName];
    }

    return Object.keys(this.eventHandlers[eventName]).length > 0;
  }
}
