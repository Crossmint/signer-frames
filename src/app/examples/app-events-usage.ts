/**
 * Application-specific Event Usage Examples
 */

import XMIF from "../../index.js";
import { AppEvents } from "../events/index.js";

// Initialize the framework
const app = new XMIF().init();

// Register authentication event handlers
app.on(AppEvents.Auth.LOGIN, "auth-controller", {
  handle: async (data) => {
    console.log(`Attempting login for user: ${data.username}`);

    // Simulate authentication
    const success = data.username === "admin" && data.password === "password";

    if (success) {
      return {
        success: true,
        data: {
          userId: "user_1",
          token: "jwt_token_example",
          expiresAt: Date.now() + 3600000, // 1 hour
        },
      };
    }

    return {
      success: false,
      error: new Error("Invalid credentials"),
    };
  },
});

// Register UI event handlers
app.on(AppEvents.UI.MODAL_OPEN, "modal-controller", {
  handle: async (data) => {
    console.log(`Opening modal: ${data.id}, component: ${data.component}`);

    // Simulate modal opening logic
    document.body.classList.add("modal-open");

    return {
      success: true,
      data: {
        opened: true,
      },
    };
  },
});

app.on(AppEvents.UI.MODAL_CLOSE, "modal-controller", {
  handle: async (data) => {
    console.log(`Closing modal: ${data.id}`);

    // Simulate modal closing logic
    document.body.classList.remove("modal-open");

    return {
      success: true,
      data: {
        closed: true,
      },
    };
  },
});

// Example usage
async function applicationFlow() {
  // Simulate login
  const loginResult = await app.emit(AppEvents.Auth.LOGIN, {
    username: "admin",
    password: "password",
  });

  if (loginResult?.success) {
    console.log("Login successful!", loginResult.data);

    // Open a modal after successful login
    await app.emit(AppEvents.UI.MODAL_OPEN, {
      id: "welcome-modal",
      component: "WelcomeMessage",
      props: {
        username: "admin",
        lastLogin: new Date().toISOString(),
      },
    });

    // Simulate user interaction then close the modal
    setTimeout(async () => {
      await app.emit(AppEvents.UI.MODAL_CLOSE, {
        id: "welcome-modal",
      });

      // Logout after modal is closed
      await app.emit(AppEvents.Auth.LOGOUT, {
        userId: loginResult.data.userId,
      });

      console.log("User logged out");
    }, 2000);
  } else {
    console.error("Login failed:", loginResult?.error?.message);
  }
}

// Run the example when in browser environment
if (typeof window !== "undefined") {
  applicationFlow().catch(console.error);
}
