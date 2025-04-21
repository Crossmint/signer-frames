import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { StorageService, type StorageItem } from './storage';
import { ApplicationError } from '../errors';

// Create mocks
const mockDatabase = mock<IDBDatabase>();
const mockObjectStore = mock<IDBObjectStore>();
const mockTransaction = mock<IDBTransaction>();

beforeEach(() => {
  vi.clearAllMocks();

  // Reset mock implementations
  mockTransaction.objectStore.mockReturnValue(mockObjectStore);
  mockDatabase.transaction.mockReturnValue(mockTransaction);

  // Mock indexedDB global
  vi.stubGlobal('indexedDB', {
    open: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StorageService', () => {
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const storage = new StorageService();
      expect(storage).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const storage = new StorageService({
        name: 'CustomDB',
        version: 2,
        stores: ['custom'],
      });
      expect(storage).toBeDefined();
    });
  });

  describe('store operations', () => {
    // We'll simply mock the database initialization and test the API
    it('should store an item without expiry', async () => {
      // Setup
      const storage = new StorageService();
      const item: StorageItem = { id: 'test-id', name: 'Test Item' };

      // Mock initDatabase to avoid actual IndexedDB operations
      vi.spyOn(storage, 'initDatabase').mockImplementation(() => {
        return Promise.resolve(mockDatabase);
      });

      // Mock put operation to return success
      mockObjectStore.put.mockImplementation(() => {
        const request = {} as IDBRequest;
        setTimeout(() => {
          request.onsuccess?.(new Event('success'));
        }, 0);
        return request;
      });

      // Execute and verify
      const result = await storage.storeItem('keys', item);
      expect(result).toEqual(item);
      expect(mockDatabase.transaction).toHaveBeenCalledWith(['keys'], 'readwrite');
      expect(mockObjectStore.put).toHaveBeenCalledWith(item);
    });

    it('should throw an error if item has no id', async () => {
      // Setup
      const storage = new StorageService();
      const invalidItem = { name: 'No ID' } as unknown as StorageItem;

      // Test and verify
      await expect(storage.storeItem('keys', invalidItem)).rejects.toThrow(
        'Data must have an id property'
      );
    });

    it('should retrieve an item by id', async () => {
      // Setup
      const storage = new StorageService();
      const item: StorageItem = { id: 'test-id', name: 'Test Item' };

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock get operation to return success with the item
      mockObjectStore.get.mockImplementation(() => {
        const request = {} as IDBRequest;
        // Set the result property
        Object.defineProperty(request, 'result', {
          value: item,
        });
        // Trigger success callback
        setTimeout(() => {
          request.onsuccess?.(new Event('success'));
        }, 0);
        return request;
      });

      // Execute and verify
      const result = await storage.getItem('keys', 'test-id');
      expect(result).toEqual(item);
      expect(mockDatabase.transaction).toHaveBeenCalledWith(['keys'], 'readonly');
      expect(mockObjectStore.get).toHaveBeenCalledWith('test-id');
    });

    it('should delete an item by id', async () => {
      // Setup
      const storage = new StorageService();

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock delete operation to return success
      mockObjectStore.delete.mockImplementation(() => {
        const request = {} as IDBRequest;
        setTimeout(() => {
          request.onsuccess?.(new Event('success'));
        }, 0);
        return request;
      });

      // Execute and verify
      await storage.deleteItem('keys', 'test-id');
      expect(mockDatabase.transaction).toHaveBeenCalledWith(['keys'], 'readwrite');
      expect(mockObjectStore.delete).toHaveBeenCalledWith('test-id');
    });

    it('should list all items in a store', async () => {
      // Setup
      const storage = new StorageService();
      const items: StorageItem[] = [
        { id: 'item1', name: 'Item 1' },
        { id: 'item2', name: 'Item 2' },
      ];

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock getAll operation to return success with the items
      mockObjectStore.getAll.mockImplementation(() => {
        const request = {} as IDBRequest;
        // Set the result property
        Object.defineProperty(request, 'result', {
          value: items,
        });
        // Trigger success callback
        setTimeout(() => {
          request.onsuccess?.(new Event('success'));
        }, 0);
        return request;
      });

      // Execute and verify
      const result = await storage.listItems('keys');
      expect(result).toEqual(items);
      expect(mockDatabase.transaction).toHaveBeenCalledWith(['keys'], 'readonly');
      expect(mockObjectStore.getAll).toHaveBeenCalled();
    });

    it('should store an item with expiry', async () => {
      // Setup
      const storage = new StorageService();
      const item: StorageItem = { id: 'test-id', name: 'Test Item' };
      const expiresIn = 60000; // 1 minute
      const now = 1625097600000; // Fixed timestamp for testing

      // Mock Date.now
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock put operation to return success
      mockObjectStore.put.mockImplementation(value => {
        // Capture the stored item
        const request = {} as IDBRequest;
        setTimeout(() => {
          request.onsuccess?.(new Event('success'));
        }, 0);
        return request;
      });

      // Execute
      const result = await storage.storeItem('keys', item, expiresIn);

      // Verify
      expect(result).toHaveProperty('expires', now + expiresIn);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-id',
          name: 'Test Item',
          expires: now + expiresIn,
        })
      );
    });

    it('should return null when getting an expired item and delete it', async () => {
      // Setup
      const storage = new StorageService();
      const now = 1625097600000; // Fixed timestamp for testing
      const expiredItem: StorageItem & { expires: number } = {
        id: 'expired-id',
        name: 'Expired Item',
        expires: now - 1000, // expired 1 second ago
      };

      // Mock Date.now
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Spy on deleteItem
      const deleteItemSpy = vi.spyOn(storage, 'deleteItem').mockResolvedValue();

      // Mock get operation to return the expired item
      mockObjectStore.get.mockImplementation(() => {
        const request = {} as IDBRequest;
        // Set the result property to the expired item
        Object.defineProperty(request, 'result', {
          value: expiredItem,
        });
        // Trigger success callback
        setTimeout(() => {
          request.onsuccess?.(new Event('success'));
        }, 0);
        return request;
      });

      // Execute
      const result = await storage.getItem('keys', 'expired-id');

      // Verify
      expect(result).toBeNull();
      expect(deleteItemSpy).toHaveBeenCalledWith('keys', 'expired-id');
    });

    it('should filter out expired items when listing', async () => {
      // Setup
      const storage = new StorageService();
      const now = 1625097600000; // Fixed timestamp for testing

      // Array with mix of expired and valid items
      const items: Array<StorageItem & { expires?: number }> = [
        { id: 'item1', name: 'Valid Item 1' }, // no expiry
        { id: 'item2', name: 'Valid Item 2', expires: now + 1000 }, // not expired
        { id: 'item3', name: 'Expired Item', expires: now - 1000 }, // expired
      ];

      // Mock Date.now
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Spy on deleteItem
      const deleteItemSpy = vi.spyOn(storage, 'deleteItem').mockResolvedValue();

      // Mock getAll operation to return the mix of items
      mockObjectStore.getAll.mockImplementation(() => {
        const request = {} as IDBRequest;
        // Set the result property to the mix of items
        Object.defineProperty(request, 'result', {
          value: items,
        });
        // Trigger success callback
        setTimeout(() => {
          request.onsuccess?.(new Event('success'));
        }, 0);
        return request;
      });

      // Execute
      const result = await storage.listItems('keys');

      // Verify
      expect(result).toHaveLength(2); // Only non-expired items
      expect(result[0].id).toBe('item1');
      expect(result[1].id).toBe('item2');
      expect(deleteItemSpy).toHaveBeenCalledWith('keys', 'item3');
    });
  });

  describe('storeWithExpiry', () => {
    it('should call storeItem with the correct ttl parameter', async () => {
      // Setup
      const storage = new StorageService();
      const item: StorageItem = { id: 'test-id', name: 'Test Item' };
      const ttl = 60000; // 1 minute

      // Spy on storeItem
      vi.spyOn(storage, 'storeItem').mockResolvedValue(item);

      // Execute
      await storage.storeWithExpiry('keys', item, ttl);

      // Verify
      expect(storage.storeItem).toHaveBeenCalledWith('keys', item, ttl);
    });
  });

  describe('createInstance', () => {
    it('should create a new StorageService instance', () => {
      const storage = StorageService.createInstance();
      expect(storage).toBeInstanceOf(StorageService);
    });

    it('should create an instance with custom options', () => {
      const options = { name: 'CustomDB', version: 2 };
      const storage = StorageService.createInstance(options);
      expect(storage).toBeInstanceOf(StorageService);
    });
  });

  describe('error handling', () => {
    it('should handle database initialization error', async () => {
      // Setup
      const storage = new StorageService();
      const mockError = new Error('Database initialization failed');

      // Mock indexedDB.open to throw an error
      vi.stubGlobal('indexedDB', {
        open: vi.fn().mockImplementation(() => {
          throw mockError;
        }),
      });

      // Execute and verify
      await expect(storage.initDatabase()).rejects.toThrow(ApplicationError);
    });

    it('should handle put request error', async () => {
      // Setup
      const storage = new StorageService();
      const item: StorageItem = { id: 'test-id', name: 'Test Item' };
      const mockError = new Error('Store error');

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock put operation to fail
      mockObjectStore.put.mockImplementation(() => {
        const request = {} as IDBRequest;
        // Set error property
        Object.defineProperty(request, 'error', {
          value: mockError,
        });
        // Trigger error callback
        setTimeout(() => {
          request.onerror?.(new Event('error'));
        }, 0);
        return request;
      });

      // Execute and verify
      await expect(storage.storeItem('keys', item)).rejects.toThrow(ApplicationError);
    });

    it('should handle get request error', async () => {
      // Setup
      const storage = new StorageService();
      const mockError = new Error('Get error');

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock get operation to fail
      mockObjectStore.get.mockImplementation(() => {
        const request = {} as IDBRequest;
        // Set error property
        Object.defineProperty(request, 'error', {
          value: mockError,
        });
        // Trigger error callback
        setTimeout(() => {
          request.onerror?.(new Event('error'));
        }, 0);
        return request;
      });

      // Execute and verify
      await expect(storage.getItem('keys', 'test-id')).rejects.toThrow(ApplicationError);
    });

    it('should handle delete request error', async () => {
      // Setup
      const storage = new StorageService();
      const mockError = new Error('Delete error');

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock delete operation to fail
      mockObjectStore.delete.mockImplementation(() => {
        const request = {} as IDBRequest;
        // Set error property
        Object.defineProperty(request, 'error', {
          value: mockError,
        });
        // Trigger error callback
        setTimeout(() => {
          request.onerror?.(new Event('error'));
        }, 0);
        return request;
      });

      // Execute and verify
      await expect(storage.deleteItem('keys', 'test-id')).rejects.toThrow(ApplicationError);
    });

    it('should handle list request error', async () => {
      // Setup
      const storage = new StorageService();
      const mockError = new Error('List error');

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock getAll operation to fail
      mockObjectStore.getAll.mockImplementation(() => {
        const request = {} as IDBRequest;
        // Set error property
        Object.defineProperty(request, 'error', {
          value: mockError,
        });
        // Trigger error callback
        setTimeout(() => {
          request.onerror?.(new Event('error'));
        }, 0);
        return request;
      });

      // Execute and verify
      await expect(storage.listItems('keys')).rejects.toThrow(ApplicationError);
    });
  });
});
