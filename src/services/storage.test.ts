import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { StorageService, type StorageItem, Stores } from './storage';

const mockDatabase = mock<IDBDatabase>();
const mockObjectStore = mock<IDBObjectStore>();
const mockTransaction = mock<IDBTransaction>();

beforeEach(() => {
  vi.clearAllMocks();

  mockTransaction.objectStore.mockReturnValue(mockObjectStore);
  mockDatabase.transaction.mockReturnValue(mockTransaction);

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
      const result = await storage.storeItem(Stores.SETTINGS, item);
      expect(result).toEqual(item);
      expect(mockDatabase.transaction).toHaveBeenCalledWith([Stores.SETTINGS], 'readwrite');
      expect(mockObjectStore.put).toHaveBeenCalledWith(item);
    });

    it('should throw an error if item has no id', async () => {
      // Setup
      const storage = new StorageService();
      const invalidItem = { name: 'No ID' } as unknown as StorageItem;

      // Test and verify
      await expect(storage.storeItem(Stores.SETTINGS, invalidItem)).rejects.toThrow(
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
      const result = await storage.getItem(Stores.SETTINGS, 'test-id');
      expect(result).toEqual(item);
      expect(mockDatabase.transaction).toHaveBeenCalledWith([Stores.SETTINGS], 'readonly');
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
      await storage.deleteItem(Stores.SETTINGS, 'test-id');
      expect(mockDatabase.transaction).toHaveBeenCalledWith([Stores.SETTINGS], 'readwrite');
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
      const result = await storage.listItems(Stores.SETTINGS);
      expect(result).toEqual(items);
      expect(mockDatabase.transaction).toHaveBeenCalledWith([Stores.SETTINGS], 'readonly');
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
      mockObjectStore.put.mockImplementation(() => {
        // Capture the stored item
        const request = {} as IDBRequest;
        setTimeout(() => {
          request.onsuccess?.(new Event('success'));
        }, 0);
        return request;
      });

      // Execute
      const result = await storage.storeItem(Stores.SETTINGS, item, expiresIn);

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
      const result = await storage.getItem(Stores.SETTINGS, 'expired-id');

      // Verify
      expect(result).toBeNull();
      expect(deleteItemSpy).toHaveBeenCalledWith(Stores.SETTINGS, 'expired-id');
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
      const result = await storage.listItems(Stores.SETTINGS);

      // Verify
      expect(result).toHaveLength(2); // Only non-expired items
      expect(result[0].id).toBe('item1');
      expect(result[1].id).toBe('item2');
      expect(deleteItemSpy).toHaveBeenCalledWith(Stores.SETTINGS, 'item3');
    });

    it('should list items and filter out expired items', async () => {
      // Setup
      const storage = new StorageService();
      const now = 1625097600000; // Fixed timestamp for testing

      const items: StorageItem[] = [
        { id: 'item1', name: 'Item 1' },
        { id: 'item2', name: 'Item 2', expires: now - 1000 }, // expired
        { id: 'item3', name: 'Item 3' },
      ];

      // Mock Date.now
      vi.spyOn(Date, 'now').mockReturnValue(now);

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

      // Mock deleteItem to return success
      vi.spyOn(storage, 'deleteItem').mockResolvedValue();

      // Execute and verify
      const result = await storage.listItems(Stores.SETTINGS);

      // Should return non-expired items
      expect(result).toEqual([
        { id: 'item1', name: 'Item 1' },
        { id: 'item3', name: 'Item 3' },
      ]);

      // Should try to delete expired item
      expect(storage.deleteItem).toHaveBeenCalledWith(Stores.SETTINGS, 'item2');
    });

    it('should check if an item has expired', async () => {
      // Setup
      const storage = new StorageService();
      const now = 1625097600000; // Fixed timestamp for testing

      // Mock Date.now
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Test with expired item
      const expiredItem = { id: 'expired', expires: now - 1000 };
      const validItem = { id: 'valid', expires: now + 1000 };
      const noExpiryItem = { id: 'noexpiry' };

      // Use private method via type cast to test hasExpired
      const hasExpired = (
        storage as unknown as { hasExpired(item: StorageItem): boolean }
      ).hasExpired.bind(storage);

      expect(hasExpired(expiredItem)).toBe(true);
      expect(hasExpired(validItem)).toBe(false);
      expect(hasExpired(noExpiryItem)).toBe(false);
    });

    it('should store with expiry method', async () => {
      // Setup
      const storage = new StorageService();
      const item: StorageItem = { id: 'test-id', name: 'Test Item' };
      const ttl = 60000; // 1 minute

      // Mock storeItem method
      const storeItemSpy = vi.spyOn(storage, 'storeItem').mockResolvedValue(item);

      // Call storeWithExpiry
      await (
        storage as unknown as {
          storeWithExpiry(storeName: Stores, item: StorageItem, ttl: number): Promise<StorageItem>;
        }
      ).storeWithExpiry(Stores.SETTINGS, item, ttl);

      // Verify storeItem was called with correct params
      expect(storeItemSpy).toHaveBeenCalledWith(Stores.SETTINGS, item, ttl);
    });
  });

  describe('static methods', () => {
    it('should create instance with createInstance static method', () => {
      const instance = StorageService.createInstance();
      expect(instance).toBeInstanceOf(StorageService);

      const customInstance = StorageService.createInstance({
        name: 'CustomDB',
        version: 3,
        stores: ['custom1', 'custom2'],
      });
      expect(customInstance).toBeInstanceOf(StorageService);
    });
  });

  describe('error handling', () => {
    it('should handle database initialization error', async () => {
      const storage = new StorageService();

      // Mock indexedDB.open to fail immediately without using onerror callback
      vi.stubGlobal('indexedDB', {
        open: vi.fn().mockImplementation(() => {
          throw new Error('Database connection failed');
        }),
      });

      await expect(storage.initDatabase()).rejects.toThrow(/Database initialization error/);
    });

    it('should handle store operations errors', async () => {
      const storage = new StorageService();
      const item: StorageItem = { id: 'test-id', name: 'Test Item' };

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock put operation to return error
      mockObjectStore.put.mockImplementation(() => {
        const request = {} as IDBRequest;

        // Mock error property
        Object.defineProperty(request, 'error', {
          value: new Error('Store operation failed'),
        });

        setTimeout(() => {
          request.onerror?.(new Event('error'));
        }, 0);

        return request;
      });

      await expect(storage.storeItem(Stores.SETTINGS, item)).rejects.toThrow(
        'Failed to store item'
      );
    });

    it('should handle getItem error', async () => {
      const storage = new StorageService();

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock get operation to return error
      mockObjectStore.get.mockImplementation(() => {
        const request = {} as IDBRequest;

        // Mock error property
        Object.defineProperty(request, 'error', {
          value: new Error('Get operation failed'),
        });

        setTimeout(() => {
          request.onerror?.(new Event('error'));
        }, 0);

        return request;
      });

      await expect(storage.getItem(Stores.SETTINGS, 'test-id')).rejects.toThrow(
        'Failed to retrieve item'
      );
    });

    it('should handle getItem with expired item', async () => {
      const storage = new StorageService();
      const now = 1625097600000; // Fixed timestamp for testing
      const expiredItem = { id: 'expired', expires: now - 1000 };

      // Mock Date.now
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock deleteItem
      vi.spyOn(storage, 'deleteItem').mockResolvedValue();

      // Mock get operation to return expired item
      mockObjectStore.get.mockImplementation(() => {
        const request = {} as IDBRequest;

        // Set the result property
        Object.defineProperty(request, 'result', {
          value: expiredItem,
        });

        setTimeout(() => {
          request.onsuccess?.(new Event('success'));
        }, 0);

        return request;
      });

      const result = await storage.getItem(Stores.SETTINGS, 'expired');
      expect(result).toBeNull();
      expect(storage.deleteItem).toHaveBeenCalledWith(Stores.SETTINGS, 'expired');
    });

    it('should handle deleteItem error', async () => {
      const storage = new StorageService();

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock delete operation to return error
      mockObjectStore.delete.mockImplementation(() => {
        const request = {} as IDBRequest;

        // Mock error property
        Object.defineProperty(request, 'error', {
          value: new Error('Delete operation failed'),
        });

        setTimeout(() => {
          request.onerror?.(new Event('error'));
        }, 0);

        return request;
      });

      await expect(storage.deleteItem(Stores.SETTINGS, 'test-id')).rejects.toThrow(
        'Failed to delete item'
      );
    });

    it('should handle listItems error', async () => {
      const storage = new StorageService();

      // Mock initDatabase
      vi.spyOn(storage, 'initDatabase').mockResolvedValue(mockDatabase);

      // Mock getAll operation to return error
      mockObjectStore.getAll.mockImplementation(() => {
        const request = {} as IDBRequest;

        // Mock error property
        Object.defineProperty(request, 'error', {
          value: new Error('List operation failed'),
        });

        setTimeout(() => {
          request.onerror?.(new Event('error'));
        }, 0);

        return request;
      });

      await expect(storage.listItems(Stores.SETTINGS)).rejects.toThrow('Failed to list items');
    });
  });
});

describe('StorageService Database Initialization', () => {
  // Mock IDB with proper TypeScript types
  interface MockObjectStore {
    name: string;
    keyPath: string;
    createIndex: ReturnType<typeof vi.fn>;
  }

  let mockIDBDatabase: {
    objectStoreNames: { contains: (name: string) => boolean };
    createObjectStore: ReturnType<typeof vi.fn>;
  };
  let mockIDBObjectStoreNames: string[] = [];
  let mockObjectStores: Map<string, MockObjectStore> = new Map();
  let createObjectStoreSpy: ReturnType<typeof vi.spyOn>;
  let mockOpenDBRequest: {
    onupgradeneeded: ((event: Event) => void) | null;
    onsuccess: ((event: Event) => void) | null;
    onerror: ((event: Event) => void) | null;
  };
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset storage DB by accessing the property via a method
    // Use Object.defineProperty directly instead of casting
    Object.defineProperty(StorageService, 'db', { value: null, writable: true });

    // Reset mock collections
    mockIDBObjectStoreNames = [];
    mockObjectStores = new Map();

    // Mock IDB database
    mockIDBDatabase = {
      objectStoreNames: {
        contains: (name: string) => mockIDBObjectStoreNames.includes(name),
      },
      createObjectStore: vi.fn((name, options) => {
        mockIDBObjectStoreNames.push(name);
        const mockStore = {
          name,
          keyPath: options.keyPath,
          createIndex: vi.fn(),
        };
        mockObjectStores.set(name, mockStore);
        return mockStore;
      }),
    };

    createObjectStoreSpy = vi.spyOn(mockIDBDatabase, 'createObjectStore');

    // Mock the indexedDB.open
    mockOpenDBRequest = {
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
    };

    openSpy = vi.fn().mockReturnValue(mockOpenDBRequest);

    // Replace global indexedDB
    vi.stubGlobal('indexedDB', {
      open: openSpy,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('should create all required stores when initializing the database', async () => {
    // Arrange
    const storageService = new StorageService();
    let upgradeCalled = false;

    // Comment out unused variables
    // let dbPromiseResolve: (value: void | PromiseLike<void>) => void;
    // const dbPromise = new Promise<void>(resolve => {
    //   dbPromiseResolve = resolve;
    // });

    // Act - Start database initialization
    const promise = storageService.initDatabase();

    // Verify open was called with correct params
    expect(openSpy).toHaveBeenCalledWith('CrossmintVault', 2);

    // Simulate onupgradeneeded with proper type casting
    mockOpenDBRequest.onupgradeneeded?.({
      target: {
        result: mockIDBDatabase,
      },
    } as unknown as Event);

    // Mark upgrade as called
    upgradeCalled = true;

    // Simulate onsuccess with proper type casting
    mockOpenDBRequest.onsuccess?.({
      target: {
        result: mockIDBDatabase,
      },
    } as unknown as Event);

    // Wait for the initialization promise
    await promise;

    // Assert
    expect(upgradeCalled).toBe(true);

    // Check that all required stores were created
    expect(mockIDBObjectStoreNames).toContain(Stores.DEVICE_SHARES);
    expect(mockIDBObjectStoreNames).toContain(Stores.AUTH_SHARES);
    expect(mockIDBObjectStoreNames).toContain(Stores.SETTINGS);

    // Verify correct options were used
    const deviceStore = mockObjectStores.get(Stores.DEVICE_SHARES);
    // Check if deviceStore exists before accessing properties
    expect(deviceStore).toBeDefined();
    if (deviceStore) {
      expect(deviceStore.keyPath).toBe('id');
      expect(deviceStore.createIndex).toHaveBeenCalledWith('type', 'type', { unique: false });
      expect(deviceStore.createIndex).toHaveBeenCalledWith('created', 'created', { unique: false });
    }

    const authStore = mockObjectStores.get(Stores.AUTH_SHARES);
    expect(authStore).toBeDefined();
    if (authStore) {
      expect(authStore.keyPath).toBe('id');
    }
  });

  it('should not create stores if they already exist', async () => {
    // Arrange - Simulate stores already existing
    mockIDBObjectStoreNames = [Stores.DEVICE_SHARES, Stores.AUTH_SHARES, Stores.SETTINGS];

    const storageService = new StorageService();

    // Act - Start database initialization
    const promise = storageService.initDatabase();

    // Simulate onupgradeneeded with proper type casting
    mockOpenDBRequest.onupgradeneeded?.({
      target: {
        result: mockIDBDatabase,
      },
    } as unknown as Event);

    // Simulate onsuccess with proper type casting
    mockOpenDBRequest.onsuccess?.({
      target: {
        result: mockIDBDatabase,
      },
    } as unknown as Event);

    // Wait for the initialization promise
    await promise;

    // Assert - createObjectStore should not have been called
    expect(createObjectStoreSpy).not.toHaveBeenCalled();
  });

  it('should handle initialization errors', async () => {
    // Arrange
    const storageService = new StorageService();
    const error = new Error('DB initialization failed');

    // Act - Start database initialization
    const promise = storageService.initDatabase();

    // Simulate onerror with proper type casting
    mockOpenDBRequest.onerror?.({
      target: {
        error,
      },
    } as unknown as Event);

    // Assert - Promise should reject
    await expect(promise).rejects.toThrow('Failed to open database');
  });
});
