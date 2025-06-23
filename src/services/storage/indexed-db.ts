import { CrossmintFrameService } from '../service';

const DB_NAME = 'CrossmintFrameDB';
const DB_VERSION = 1;

export const SHARDS_STORE_NAME = 'shardsStore';
export const ENCRYPTION_KEYS_STORE_NAME = 'encryptionKeysStore';
const ALL_STORES = [SHARDS_STORE_NAME, ENCRYPTION_KEYS_STORE_NAME];

export class IndexedDBAdapter extends CrossmintFrameService {
  name = 'IndexedDB service';
  log_prefix = '[IndexedDB]';
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  public async init(): Promise<void> {
    await this.openDB();
  }

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

  private createStore(db: IDBDatabase, storeName: string) {
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName);
    }
  }

  public async getItem<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Error getting item with key ${key}: ${request.error?.message}`));
      };
    });
  }

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
}
