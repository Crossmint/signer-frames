/**
 * Event handlers module
 * Centralizes all event handlers for the application
 */

/**
 * Event handler registry
 * Maps event names to their handler functions
 * @type {Object.<string, Function>}
 */
const eventHandlers = {
  "request:sign-message": () => ({ error: true, message: "Not implemented" }),
  "request:sign-transaction": () => ({
    error: true,
    message: "Not implemented",
  }),
  "request:attestation": () => ({ error: true, message: "Not implemented" }),
  "request:send-otp": () => ({ error: true, message: "Not implemented" }),
  "request:create-signer": () => ({ error: true, message: "Not implemented" }),
};

// Export the handlers directly so they can be accessed via namespace imports
export const handlers = eventHandlers;

/**
 * Register an event handler
 * @param {string} eventName - Name of the event
 * @param {Function} handler - Handler function for the event
 */
export function registerHandler(eventName, handler) {
  eventHandlers[eventName] = handler;
}

/**
 * Process an event
 * @param {string} eventName - Name of the event
 * @param {Object} data - Event data
 * @returns {Promise<any>} - Result of the event handler
 * @throws {Error} If no handler registered for the event
 */
export async function processEvent(eventName, data) {
  if (!eventHandlers[eventName]) {
    throw new Error(`No handler registered for event: ${eventName}`);
  }

  const result = await eventHandlers[eventName](data);

  // If this is a request event, send a corresponding response event to parent
  if (eventName.startsWith("request:")) {
    const responseEventName = eventName.replace("request:", "response:");
    sendResponseToParent(responseEventName, result);
  }

  return result;
}

/**
 * Send a response event to the parent
 * @param {string} eventName - Name of the response event
 * @param {any} data - Response data
 */
export function sendResponseToParent(eventName, data) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(
      {
        type: eventName,
        data,
      },
      "*"
    );
  } else if (process?.send) {
    // For Node.js environment
    process.send({
      type: eventName,
      data,
    });
  }
}

/**
 * Initialize the events module
 * @returns {Object} - The events API
 */
export function init() {
  return {
    registerHandler,
    processEvent,
    sendResponseToParent,
  };
}

export default {
  registerHandler,
  processEvent,
  sendResponseToParent,
  handlers: eventHandlers,
};
