/**
 * StorageManager - Handles IndexedDB and LocalStorage operations
 */

// Constants
export const DB_NAME = 'CrossmintVault';
export const DB_VERSION = 1;
export const KEYS_STORE = 'keys';
export const SETTINGS_STORE = 'settings';

// LocalStorage key constants
export const LOCAL_KEY_PREFIX = 'XMIF_';

let db = null;

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>} A promise that resolves to the opened database
 */
export function initDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }
        
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            
            // Create object stores if they don't exist
            if (!database.objectStoreNames.contains(KEYS_STORE)) {
                const keyStore = database.createObjectStore(KEYS_STORE, { keyPath: 'id' });
                keyStore.createIndex('type', 'type', { unique: false });
                keyStore.createIndex('created', 'created', { unique: false });
            }
            
            if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
                database.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
            }
        };
    });
}

/**
 * Store an item in IndexedDB with expiry
 * @param {string} storeName - The name of the object store
 * @param {Object} item - The item to store
 * @returns {Promise<any>} A promise that resolves when the item is stored
 */
export async function storeItem(storeName, item) {
    const database = await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const request = store.put(item);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Retrieve an item from IndexedDB
 * @param {string} storeName - The name of the object store
 * @param {string} id - The ID of the item to retrieve
 * @returns {Promise<any>} A promise that resolves to the retrieved item
 */
export async function getItem(storeName, id) {
    const database = await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        const request = store.get(id);
        
        request.onsuccess = () => {
            const item = request.result;
            
            // Check if item has expired
            if (item?.expires && item.expires < Date.now()) {
                // Item has expired, delete it and return null
                deleteItem(storeName, id).catch(console.error);
                resolve(null);
            } else {
                resolve(item);
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete an item from IndexedDB
 * @param {string} storeName - The name of the object store
 * @param {string} id - The ID of the item to delete
 * @returns {Promise<void>} A promise that resolves when the item is deleted
 */
export async function deleteItem(storeName, id) {
    const database = await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * List all items in an IndexedDB store
 * @param {string} storeName - The name of the object store
 * @returns {Promise<Array>} A promise that resolves to an array of items
 */
export async function listItems(storeName) {
    const database = await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Store an item in localStorage with an expiration time
 * @param {string} key - The key to store the value under
 * @param {string} value - The value to store
 * @param {number} ttl - The time-to-live in milliseconds
 */
export function setItemWithExpiry(key, value, ttl) {
    const now = new Date();
    const item = {
        value: value,
        expiry: now.getTime() + ttl
    };
    
    localStorage.setItem(`${LOCAL_KEY_PREFIX}${key}`, JSON.stringify(item));
}

/**
 * Get an item from localStorage, checking if it has expired
 * @param {string} key - The key to retrieve the value for
 * @returns {string|null} The stored value or null if expired/not found
 */
export function getItemWithExpiry(key) {
    const itemStr = localStorage.getItem(`${LOCAL_KEY_PREFIX}${key}`);
    
    // Return null if no item found
    if (!itemStr) {
        return null;
    }
    
    const item = JSON.parse(itemStr);
    const now = new Date();
    
    // Compare the expiry time with the current time
    if (now.getTime() > item.expiry) {
        // Item has expired, remove it from localStorage
        localStorage.removeItem(`${LOCAL_KEY_PREFIX}${key}`);
        return null;
    }
    
    return item.value;
}

/**
 * Remove an item from localStorage
 * @param {string} key - The key to remove
 */
export function removeItem(key) {
    localStorage.removeItem(`${LOCAL_KEY_PREFIX}${key}`);
} 