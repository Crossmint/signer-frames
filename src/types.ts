/**
 * Common type definitions for the application
 */

// Storage item interface
export interface StorageItem {
  id: string;
  [key: string]: unknown;
}

// Storage providers
export interface StorageProvider {
  storeItem(
    storeName: string,
    item: StorageItem,
    expiresIn?: number
  ): Promise<StorageItem>;
  storeWithExpiry(
    storeName: string,
    item: StorageItem,
    ttl: number
  ): Promise<StorageItem>;
  getItem(storeName: string, id: string): Promise<StorageItem | null>;
  deleteItem(storeName: string, id: string): Promise<void>;
  listItems(storeName: string): Promise<StorageItem[]>;
  setItemWithExpiry(key: string, value: unknown, ttl: number): void;
  getItemWithExpiry(key: string): unknown | null;
  removeItem(key: string): void;
}
