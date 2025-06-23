import { CrossmintFrameService } from '../service';

const DB_NAME = 'CrossmintFrameDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyStore';

export class IndexedDBAdapter extends CrossmintFrameService {
  name = 'IndexedDB service';
  log_prefix = '[IndexedDB]';
  private db: IDBDatabase | null = null;

  public async init(): Promise<void> {
    await this.openDB();
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = event => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = event => {
        reject(`IndexedDB error: ${(event.target as IDBOpenDBRequest).error}`);
      };
    });
  }

  public async getItem<T>(key: IDBValidKey): Promise<T | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Error getting item with key ${key}: ${request.error?.message}`));
      };
    });
  }

  public async setItem<T>(key: IDBValidKey, value: T): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Error setting item with key ${key}: ${request.error?.message}`));
      };
    });
  }
}
