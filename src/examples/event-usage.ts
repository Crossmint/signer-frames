/**
 * Event System Usage Examples
 *
 * This file demonstrates various ways to use the event system in a XMIF application.
 */

import XMIF from "../index.js";
import type { EventHandler } from "../index.js";

// Initialize the framework
const app = new XMIF().init();

// Example 1: Basic event handling
app.on("user:created", "notification-handler", {
  handle: async (data) => {
    // Type-safe data access with IntelliSense
    console.log(`New user created: ${data.name} (${data.email})`);

    return {
      success: true,
      data: {
        success: true,
        userId: data.id,
      },
    };
  },
});

// Example 2: Defining a standalone handler that can be reused
const paymentHandler: EventHandler<"payment:processed"> = {
  handle: async (data) => {
    // Process the payment data
    console.log(
      `Payment processed: ${data.amount} ${data.currency} for order ${data.orderId}`
    );

    return {
      success: true,
      data: {
        transactionId: `txn_${Date.now()}`,
        status: "succeeded",
      },
    };
  },
};

// Register the standalone handler
app.on("payment:processed", "payment-processor", paymentHandler);

// Example 3: Error handling in events
app.on("system:error", "error-logger", {
  handle: async (data) => {
    console.error(`[ERROR] ${data.code || "UNKNOWN"}: ${data.message}`);

    // Log additional details if provided
    if (data.details) {
      console.error("Details:", data.details);
    }

    return {
      success: true,
      data: {
        handled: true,
        timestamp: Date.now(),
      },
    };
  },
});

// Example 4: Triggering events
async function processUserSignup(userData: { email: string; name: string }) {
  // Generate a user ID
  const userId = `user_${Date.now()}`;

  // Emit the user:created event
  const result = await app.emit("user:created", {
    id: userId,
    email: userData.email,
    name: userData.name,
  });

  if (result?.success) {
    console.log("User creation event processed successfully");
    return userId;
  }

  if (result) {
    // Handle error
    console.error("Failed to process user creation:", result.error);

    // Emit system error event
    await app.emit("system:error", {
      message: `Failed to create user: ${result.error.message}`,
      code: "USER_CREATION_FAILED",
      details: { userData },
    });
  }

  return null;
}

// Example 5: Unregistering event handlers
function cleanup() {
  app.off("user:created", "notification-handler");
  app.off("payment:processed", "payment-processor");
  console.log("Event handlers unregistered");
}

// Example usage
(async () => {
  await processUserSignup({
    email: "john.doe@example.com",
    name: "John Doe",
  });

  await app.emit("payment:processed", {
    orderId: "order_12345",
    amount: 99.99,
    currency: "USD",
  });

  // Check if handlers exist
  console.log("Has error handler:", app.hasEventHandler("system:error"));

  // Cleanup
  cleanup();
})();
