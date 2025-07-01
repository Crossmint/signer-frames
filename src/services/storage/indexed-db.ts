import { CrossmintFrameService } from '../service';

/** Database name for the Crossmint Frame IndexedDB instance */
const DB_NAME = 'CrossmintFrameDB';
/** Current version of the IndexedDB schema */
const DB_VERSION = 1;

/** Object store name for encryption keys storage */
export const ENCRYPTION_KEYS_STORE_NAME = 'encryptionKeysStore';
/** Array of all object store names used in the database */
const ALL_STORES = [ENCRYPTION_KEYS_STORE_NAME];

/**
 * Interface for data stored with expiration capability.
 * @template T - The type of the actual data being stored
 */
interface ExpirableData<T> {
  /** The actual data being stored */
  data: T;
  /** Timestamp (in milliseconds) when this data expires */
  expiresAt: number;
  /** Timestamp (in milliseconds) when this data was created */
  createdAt: number;
}

/**
 * Options for storing data with expiration.
 */
interface ExpirationOptions {
  /** Time-to-live in milliseconds. If provided, data will expire after this duration */
  ttlMs?: number;
  /** Absolute expiration timestamp in milliseconds. If provided, data will expire at this time */
  expiresAt?: number;
}

/**
 * IndexedDB adapter service for persistent client-side storage.
 *
 * This service provides a wrapper around the IndexedDB API with automatic database
 * initialization, store management, and error handling. It's designed to store
 * encryption keys and other sensitive data that needs to persist across iframe sessions.
 *
 * Features:
 * - Automatic database and object store creation
 * - Promise-based API for async operations
 * - Type-safe get/set operations
 * - Data expiration with TTL support
 * - Lazy cleanup of expired data
 */
export class IndexedDBAdapter extends CrossmintFrameService {
  name = 'IndexedDB service';
  log_prefix = '[IndexedDB]';

  /** The active IndexedDB database connection */
  private db: IDBDatabase | null = null;
  /** Promise for the database opening operation to prevent multiple concurrent opens */
  private openPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initializes the IndexedDB service by opening the database connection.
   *
   * This method should be called before any other operations to ensure the database
   * is properly initialized with all required object stores.
   *
   * @returns Promise that resolves when the database is successfully opened and initialized
   * @throws Error if database initialization fails
   */
  public async init(): Promise<void> {
    await this.openDB();
  }

  /**
   * Opens the IndexedDB database connection with automatic store creation and version management.
   *
   * This method handles:
   * - Creating the database if it doesn't exist
   * - Creating missing object stores
   * - Upgrading the database version when new stores are needed
   * - Reusing existing connections when possible
   *
   * @returns Promise that resolves to the opened IDBDatabase instance
   * @throws Error if database opening fails
   * @private
   */
  private openDB(): Promise<IDBDatabase> {
    if (this.openPromise) {
      return this.openPromise;
    }
    this.openPromise = new Promise((resolve, reject) => {
      if (this.db) {
        const missingStores = ALL_STORES.filter(
          store => !this.db!.objectStoreNames.contains(store)
        );
        if (missingStores.length === 0) {
          resolve(this.db);
          return;
        }

        // If stores are missing, we need to re-open with a new version
        this.db.close();
        this.db = null;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const storeName of ALL_STORES) {
          this.createStore(db, storeName);
        }
      };

      request.onsuccess = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        const missingStores = ALL_STORES.filter(store => !db.objectStoreNames.contains(store));

        if (missingStores.length > 0) {
          db.close();
          const newVersion = db.version + 1;
          const reopenRequest = indexedDB.open(DB_NAME, newVersion);

          reopenRequest.onupgradeneeded = e => {
            const upgradedDb = (e.target as IDBOpenDBRequest).result;
            for (const storeName of ALL_STORES) {
              this.createStore(upgradedDb, storeName);
            }
          };

          reopenRequest.onsuccess = e => {
            this.db = (e.target as IDBOpenDBRequest).result;
            resolve(this.db);
          };

          reopenRequest.onerror = e => {
            reject(`IndexedDB error on re-open: ${(e.target as IDBOpenDBRequest).error}`);
          };
        } else {
          this.db = db;
          resolve(this.db);
        }
      };

      request.onerror = event => {
        reject(`IndexedDB error: ${(event.target as IDBOpenDBRequest).error}`);
      };
    });
    return this.openPromise;
  }

  /**
   * Creates an object store in the database if it doesn't already exist.
   *
   * @param db - The IDBDatabase instance to create the store in
   * @param storeName - Name of the object store to create
   * @private
   */
  private createStore(db: IDBDatabase, storeName: string) {
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName);
    }
  }

  /**
   * Checks if the given expirable data has expired.
   *
   * @param data - The expirable data to check
   * @returns True if the data has expired, false otherwise
   * @private
   */
  private isExpired<T>(data: ExpirableData<T>): boolean {
    return Date.now() > data.expiresAt;
  }

  /**
   * Retrieves an item from the specified object store, automatically handling expiration.
   *
   * If the item has expired, it will be automatically removed and null will be returned.
   *
   * @template T - The expected type of the retrieved item
   * @param storeName - Name of the object store to retrieve from
   * @param key - The key of the item to retrieve
   * @returns Promise that resolves to the retrieved item, or null if not found or expired
   * @throws Error if the retrieval operation fails
   */
  public async getItem<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite'); // readwrite for potential cleanup
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Check if this is expirable data
        if (this.isExpirableData(result)) {
          if (this.isExpired(result)) {
            // Data has expired, remove it and return null
            const deleteRequest = store.delete(key);
            deleteRequest.onsuccess = () => {
              this.log(`Expired item with key ${key} automatically removed`);
              resolve(null);
            };
            deleteRequest.onerror = () => {
              this.logError(`Failed to remove expired item with key ${key}`, deleteRequest.error);
              resolve(null); // Still return null even if cleanup failed
            };
            return;
          }
          resolve(result.data as T);
        } else {
          resolve(result);
        }
      };

      request.onerror = () => {
        reject(new Error(`Error getting item with key ${key}: ${request.error?.message}`));
      };
    });
  }

  /**
   * Stores an item in the specified object store.
   *
   * @template T - The type of the item to store
   * @param storeName - Name of the object store to save to
   * @param key - The key to store the item under
   * @param value - The item to store
   * @returns Promise that resolves when the item is successfully stored
   * @throws Error if the storage operation fails
   */
  public async setItem<T>(storeName: string, key: IDBValidKey, value: T): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value, key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Error setting item with key ${key}: ${request.error?.message}`));
      };
    });
  }

  /**
   * Stores an item in the specified object store with expiration.
   *
   * @template T - The type of the item to store
   * @param storeName - Name of the object store to save to
   * @param key - The key to store the item under
   * @param value - The item to store
   * @param options - Expiration options (TTL or absolute expiration time)
   * @returns Promise that resolves when the item is successfully stored
   * @throws Error if the storage operation fails or if invalid expiration options are provided
   */
  public async setItemWithExpiration<T>(
    storeName: string,
    key: IDBValidKey,
    value: T,
    options: ExpirationOptions
  ): Promise<void> {
    const now = Date.now();
    let expiresAt: number;

    if (options.expiresAt !== undefined) {
      expiresAt = options.expiresAt;
    } else if (options.ttlMs !== undefined) {
      expiresAt = now + options.ttlMs;
    } else {
      throw new Error('Either ttlMs or expiresAt must be provided');
    }

    if (expiresAt <= now) {
      throw new Error('Expiration time must be in the future');
    }

    const expirableData: ExpirableData<T> = {
      data: value,
      expiresAt,
      createdAt: now,
    };

    await this.setItem(storeName, key, expirableData);
  }

  /**
   * Removes an item from the specified object store.
   *
   * @param storeName - Name of the object store to remove from
   * @param key - The key of the item to remove
   * @returns Promise that resolves when the item is successfully removed
   * @throws Error if the removal operation fails
   */
  public async removeItem(storeName: string, key: IDBValidKey): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Error deleting item with key ${key}: ${request.error?.message}`));
      };
    });
  }

  /**
   * Removes all expired items from the specified object store.
   *
   * This method iterates through all items in the store and removes those that have expired.
   * It's useful for manual cleanup operations or periodic maintenance.
   *
   * @param storeName - Name of the object store to clean up
   * @returns Promise that resolves to the number of expired items removed
   * @throws Error if the cleanup operation fails
   */
  public async cleanupExpiredItems(storeName: string): Promise<number> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.openCursor();
      let removedCount = 0;

      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const value = cursor.value;
          if (this.isExpirableData(value) && this.isExpired(value)) {
            const deleteRequest = cursor.delete();
            deleteRequest.onsuccess = () => {
              removedCount++;
              cursor.continue();
            };
            deleteRequest.onerror = () => {
              this.logError(
                `Failed to delete expired item with key ${cursor.key}`,
                deleteRequest.error
              );
              cursor.continue();
            };
          } else {
            cursor.continue();
          }
        } else {
          // No more entries
          this.log(`Cleanup completed: removed ${removedCount} expired items from ${storeName}`);
          resolve(removedCount);
        }
      };

      request.onerror = () => {
        reject(new Error(`Error during cleanup of ${storeName}: ${request.error?.message}`));
      };
    });
  }

  /**
   * Removes all expired items from all object stores.
   *
   * @returns Promise that resolves to the total number of expired items removed across all stores
   * @throws Error if the cleanup operation fails
   */
  public async cleanupAllExpiredItems(): Promise<number> {
    let totalRemoved = 0;
    for (const storeName of ALL_STORES) {
      try {
        const removedFromStore = await this.cleanupExpiredItems(storeName);
        totalRemoved += removedFromStore;
      } catch (error) {
        this.logError(`Error cleaning up expired items from ${storeName}`, error);
        // Continue with other stores even if one fails
      }
    }
    return totalRemoved;
  }

  /**
   * Type guard to check if data is expirable.
   *
   * @param data - The data to check
   * @returns True if the data is expirable, false otherwise
   * @private
   */
  private isExpirableData<T>(data: any): data is ExpirableData<T> {
    return (
      data &&
      typeof data === 'object' &&
      'data' in data &&
      'expiresAt' in data &&
      'createdAt' in data &&
      typeof data.expiresAt === 'number' &&
      typeof data.createdAt === 'number'
    );
  }
}
