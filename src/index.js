/**
 * KeyManager - Main entry point
 */
import * as common from './common.js';
import * as solana from './solana.js';
import * as evm from './evm.js';
import * as storage from './storage.js';
import * as events from './events.js';

// Export all modules
export { common, solana, evm, storage, events };

// Initialize the global namespace when loaded as IIFE
const init = () => {
    // Create our namespaced API
    const XMIF = {
        // Version info
        version: '1.0.0',
        
        /**
         * Initialize the XMIF framework
         * @param {Object} [options] - Initialization options
         * @param {boolean} [options.initStorage=true] - Whether to initialize storage
         * @returns {Promise<void>}
         */
        async init(options = {}) {
            const opts = {
                initStorage: true,
                ...options
            };
            
            // Initialize storage if requested
            if (opts.initStorage) {
                await storage.initDatabase();
            }
            
            // Return the initialized object for chaining
            return this;
        },
        
        /**
         * Store data in IndexedDB
         * @param {string} storeName - Name of the store
         * @param {Object} data - Data to store
         * @returns {Promise<any>} Result of the operation
         */
        async storeData(storeName, data) {
            if (!data.id) {
                throw new Error('Data must have an id property');
            }
            
            return storage.storeItem(storeName, data);
        },
        
        /**
         * Retrieve data from IndexedDB
         * @param {string} storeName - Name of the store
         * @param {string} id - ID of the item
         * @returns {Promise<any>} The retrieved item
         */
        async getData(storeName, id) {
            return storage.getItem(storeName, id);
        },
        
        /**
         * List all items in a store
         * @param {string} storeName - Name of the store
         * @returns {Promise<Array>} All items in the store
         */
        async listData(storeName) {
            return storage.listItems(storeName);
        },
        
        /**
         * Delete data from IndexedDB
         * @param {string} storeName - Name of the store
         * @param {string} id - ID of the item
         * @returns {Promise<void>} Result of the operation
         */
        async deleteData(storeName, id) {
            return storage.deleteItem(storeName, id);
        },
        
        /**
         * Store a value in localStorage with expiry
         * @param {string} key - Key to store under
         * @param {any} value - Value to store
         * @param {number} ttl - Time to live in milliseconds
         */
        storeValue(key, value, ttl) {
            storage.setItemWithExpiry(key, JSON.stringify(value), ttl);
        },
        
        /**
         * Get a value from localStorage
         * @param {string} key - Key to retrieve
         * @returns {any} The retrieved value
         */
        getValue(key) {
            const value = storage.getItemWithExpiry(key);
            return value ? JSON.parse(value) : null;
        },
        
        /**
         * Remove a value from localStorage
         * @param {string} key - Key to remove
         */
        removeValue(key) {
            storage.removeItem(key);
        },
        
        /**
         * Process an event
         * @param {string} eventName - Name of the event
         * @param {Object} data - Event data
         * @returns {Promise<any>} Result of the event handler
         */
        async processEvent(eventName, data) {
            return events.processEvent(eventName, data);
        },
        
        /**
         * Register a custom event handler
         * @param {string} eventName - Name of the event
         * @param {Function} handler - Handler function
         */
        registerEventHandler(eventName, handler) {
            events.registerHandler(eventName, handler);
        },
        
        /**
         * Convert data to various formats
         */
        format: {
            toHex: common.uint8ArrayToHex,
            fromHex: common.hexToUint8Array,
            toBase58: common.base58Encode,
            fromBase58: common.base58Decode
        },
        
        // Expose sub-modules for direct access
        Common: common,
        Solana: solana,
        EVM: evm,
        Storage: storage,
        Events: events
    };
    
    // Expose the API to the window object when loaded via script tag
    if (typeof window !== 'undefined') {
        window.XMIF = XMIF;
        console.log('XMIF framework initialized');
    }
    
    return XMIF;
};

// Initialize when loaded as IIFE
if (typeof window !== 'undefined') {
    init();
}

// Also export the init function for direct usage
export default init; 