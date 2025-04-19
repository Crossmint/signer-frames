/**
 * Event handlers module
 * Centralizes all event handlers for the application
 */
import * as common from './common.js';

/**
 * Event handler registry
 * Maps event names to their handler functions
 * @type {Object.<string, Function>}
 */
const eventHandlers = {};

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
  if (eventName.startsWith('request:')) {
    const responseEventName = eventName.replace('request:', 'response:');
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
    window.parent.postMessage({
      type: eventName,
      data
    }, '*');
  } else if (process?.send) {
    // For Node.js environment
    process.send({
      type: eventName,
      data
    });
  }
}

/**
 * Handler for the sign-message event
 * @param {Object} data - Event data
 * @param {string} data.keyId - ID of the key to use
 * @param {string|Uint8Array} data.message - Message to sign
 * @param {string} data.publicKey - Public key in hex or base58 format
 * @returns {Promise<Object>} - Signature and related information
 */
export async function handleSignSolanaMessage(data) {
  const { keyId, message, publicKey } = data;
  
  // TODO: Replace this mock implementation with actual key retrieval logic
  // This is just a placeholder - we're generating a random keypair each time
  // instead of retrieving the actual key by keyId
  const keypair = common.generateRandomKeypair();
  
  // Convert message to Uint8Array if needed
  let messageBytes = message;
  if (typeof message === 'string') {
    messageBytes = new TextEncoder().encode(message);
  }
  
  // Sign the message with the keypair
  const signature = common.sign(messageBytes, keypair.secretKey);
  
  return {
    keyId,
    signature: common.uint8ArrayToHex(signature),
    publicKey: common.uint8ArrayToHex(keypair.publicKey)
  };
}

// Register built-in handlers
registerHandler('request:sign-solana-message', handleSignSolanaMessage);

/**
 * Initialize the events module
 * @returns {Object} - The events API
 */
export function init() {
  return {
    registerHandler,
    processEvent,
    sendResponseToParent
  };
}

export default {
  registerHandler,
  processEvent,
  sendResponseToParent,
  handlers: {
    signSolanaMessage: handleSignSolanaMessage
  }
}; 