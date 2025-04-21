/**
 * StorageService - Handles data storage operations
 */

// Storage item interface
export interface StorageItem {
  id: string;
  [key: string]: unknown;
}

enum Stores {
  KEYS = 'keys',
  SETTINGS = 'settings',
}
import { ApplicationError } from '../errors';

// Constants
const DB_NAME = 'CrossmintVault';
const DB_VERSION = 1;
const KEYS_STORE = Stores.KEYS;

interface StoredItem {
  readonly value: string;
  readonly expiry: number;
}

interface ExpirableItem extends StorageItem {
  expires: number;
}

interface DBOptions {
  name: string;
  version: number;
  stores: string[];
}

export class StorageService {
  private static db: IDBDatabase | null = null;
  private readonly dbOptions: DBOptions;

  constructor(options?: Partial<DBOptions>) {
    this.dbOptions = {
      name: options?.name || DB_NAME,
      version: options?.version || DB_VERSION,
      stores: [KEYS_STORE],
    };
  }

  /**
   * Initialize the IndexedDB database
   * @returns {Promise<IDBDatabase>} A promise that resolves to the opened database
   */
  async initDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (StorageService.db) {
        resolve(StorageService.db);
        return;
      }

      try {
        const request = indexedDB.open(this.dbOptions.name, this.dbOptions.version);

        request.onerror = event => {
          const error = (event.target as IDBOpenDBRequest).error;
          console.error('Database error:', error);
          reject(
            new ApplicationError(
              `Failed to open database: ${error?.message || 'Unknown error'}`,
              'DB_OPEN_ERROR',
              error
            )
          );
        };

        request.onsuccess = event => {
          StorageService.db = (event.target as IDBOpenDBRequest).result;
          resolve(StorageService.db);
        };

        request.onupgradeneeded = event => {
          const database = (event.target as IDBOpenDBRequest).result;

          // Create object stores if they don't exist
          if (!database.objectStoreNames.contains(KEYS_STORE)) {
            const keyStore = database.createObjectStore(KEYS_STORE, {
              keyPath: 'id',
            });
            keyStore.createIndex('type', 'type', { unique: false });
            keyStore.createIndex('created', 'created', { unique: false });
          }
        };
      } catch (error) {
        reject(
          new ApplicationError(
            `Database initialization error: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            'DB_INIT_ERROR',
            error
          )
        );
      }
    });
  }

  /**
   * Store an item in IndexedDB with expiry
   * @param {string} storeName - The name of the object store
   * @param {StorageItem} item - The item to store
   * @param {number} [expiresIn] - Optional time in milliseconds until the item expires
   * @returns {Promise<StorageItem>} A promise that resolves when the item is stored
   */
  async storeItem(storeName: string, item: StorageItem, expiresIn?: number): Promise<StorageItem> {
    if (!item.id) {
      throw new Error('Data must have an id property');
    }

    // Add expiration if specified
    const itemToStore = { ...item };
    if (expiresIn && expiresIn > 0) {
      (itemToStore as ExpirableItem).expires = Date.now() + expiresIn;
    }

    try {
      const database = await this.initDatabase();

      return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        const request = store.put(itemToStore);

        request.onsuccess = () => resolve(itemToStore);
        request.onerror = () =>
          reject(
            new ApplicationError(
              `Failed to store item: ${request.error?.message || 'Unknown error'}`,
              'DB_STORE_ERROR',
              request.error
            )
          );
      });
    } catch (error) {
      throw new ApplicationError(
        `Storage operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORAGE_ERROR',
        error
      );
    }
  }

  /**
   * Retrieve an item from IndexedDB
   * @param {string} storeName - The name of the object store
   * @param {string} id - The ID of the item to retrieve
   * @returns {Promise<StorageItem | null>} A promise that resolves to the retrieved item
   */
  async getItem(storeName: string, id: string): Promise<StorageItem | null> {
    try {
      const database = await this.initDatabase();

      return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        const request = store.get(id);

        request.onsuccess = () => {
          const item = request.result as StorageItem | undefined;

          // Check if item has expired
          if (item && this.hasExpired(item)) {
            // Item has expired, delete it and return null
            this.deleteItem(storeName, id).catch(console.error);
            resolve(null);
          } else {
            resolve(item || null);
          }
        };

        request.onerror = () =>
          reject(
            new ApplicationError(
              `Failed to retrieve item: ${request.error?.message || 'Unknown error'}`,
              'DB_GET_ERROR',
              request.error
            )
          );
      });
    } catch (error) {
      throw new ApplicationError(
        `Storage operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORAGE_ERROR',
        error
      );
    }
  }

  /**
   * Delete an item from IndexedDB
   * @param {string} storeName - The name of the object store
   * @param {string} id - The ID of the item to delete
   * @returns {Promise<void>} A promise that resolves when the item is deleted
   */
  async deleteItem(storeName: string, id: string): Promise<void> {
    try {
      const database = await this.initDatabase();

      return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () =>
          reject(
            new ApplicationError(
              `Failed to delete item: ${request.error?.message || 'Unknown error'}`,
              'DB_DELETE_ERROR',
              request.error
            )
          );
      });
    } catch (error) {
      throw new ApplicationError(
        `Storage operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORAGE_ERROR',
        error
      );
    }
  }

  /**
   * List all items in an IndexedDB store
   * @param {string} storeName - The name of the object store
   * @returns {Promise<StorageItem[]>} A promise that resolves to an array of items
   */
  async listItems(storeName: string): Promise<StorageItem[]> {
    try {
      const database = await this.initDatabase();

      return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const items = request.result as StorageItem[];

          // Filter out expired items
          const validItems = items.filter(item => {
            if (this.hasExpired(item)) {
              // Item has expired, delete it
              this.deleteItem(storeName, item.id).catch(console.error);
              return false;
            }
            return true;
          });

          resolve(validItems);
        };

        request.onerror = () =>
          reject(
            new ApplicationError(
              `Failed to list items: ${request.error?.message || 'Unknown error'}`,
              'DB_LIST_ERROR',
              request.error
            )
          );
      });
    } catch (error) {
      throw new ApplicationError(
        `Storage operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORAGE_ERROR',
        error
      );
    }
  }

  /**
   * Create a storage service instance
   * @param {Partial<DBOptions>} [options] - Database options
   * @returns {StorageService} A new StorageService instance
   */
  static createInstance(options?: Partial<DBOptions>): StorageService {
    return new StorageService(options);
  }

  /**
   * Check if an item has expired
   * @param {StorageItem} item - The item to check
   * @returns {boolean} True if the item has expired
   */
  private hasExpired(item: StorageItem): boolean {
    return (
      'expires' in item &&
      typeof (item as ExpirableItem).expires === 'number' &&
      (item as ExpirableItem).expires < Date.now()
    );
  }

  /**
   * Store a time-limited item in IndexedDB
   * @param {string} storeName - The name of the object store
   * @param {StorageItem} item - The item to store
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<StorageItem>} A promise that resolves when the item is stored
   */
  async storeWithExpiry(storeName: string, item: StorageItem, ttl: number): Promise<StorageItem> {
    return this.storeItem(storeName, item, ttl);
  }
}
