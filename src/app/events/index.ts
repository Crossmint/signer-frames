/**
 * Application-specific Event Definitions
 *
 * This file extends the base EventMap with application-specific events.
 */

// Extend the EventMap interface to add application-specific events
declare module "../../services/events" {
  interface EventMap {
    // Authentication events
    "auth:login": {
      input: {
        username: string;
        password: string;
      };
      output: {
        userId: string;
        token: string;
        expiresAt: number;
      };
    };

    "auth:logout": {
      input: {
        userId: string;
      };
      output: {
        success: boolean;
      };
    };

    // Data events
    "data:sync": {
      input: {
        collection: string;
        changes: Array<{
          id: string;
          type: "create" | "update" | "delete";
          data?: Record<string, unknown>;
        }>;
      };
      output: {
        success: boolean;
        failedItems: string[];
        timestamp: number;
      };
    };

    // UI events
    "ui:modal:open": {
      input: {
        id: string;
        component: string;
        props?: Record<string, unknown>;
      };
      output: {
        opened: boolean;
      };
    };

    "ui:modal:close": {
      input: {
        id: string;
      };
      output: {
        closed: boolean;
      };
    };
  }
}

// Export constants for event names to avoid string literals
export const AppEvents = {
  Auth: {
    LOGIN: "auth:login" as const,
    LOGOUT: "auth:logout" as const,
  },
  Data: {
    SYNC: "data:sync" as const,
  },
  UI: {
    MODAL_OPEN: "ui:modal:open" as const,
    MODAL_CLOSE: "ui:modal:close" as const,
  },
};
