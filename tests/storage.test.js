import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  setItemWithExpiry, 
  getItemWithExpiry, 
  removeItem, 
  LOCAL_KEY_PREFIX 
} from '../src/storage';

// Import LOCAL_KEY_PREFIX directly from storage module or define it here if it's not exported
// const LOCAL_KEY_PREFIX = 'XMIF_';

describe('localStorage functions', () => {
  // Clear localStorage before each test
  beforeEach(() => {
    localStorage.clear();
  });

  describe('setItemWithExpiry', () => {
    it('should store an item with expiry time in localStorage', () => {
      // Arrange
      const key = 'testKey';
      const value = 'testValue';
      const ttl = 1000; // 1 second
      const now = new Date(2023, 0, 1, 12, 0, 0);
      
      // Mock Date constructor
      vi.spyOn(global, 'Date').mockImplementation(() => now);
      
      // Act
      setItemWithExpiry(key, value, ttl);
      
      // Assert
      const storedItem = JSON.parse(localStorage.getItem(`${LOCAL_KEY_PREFIX}${key}`));
      expect(storedItem).toEqual({
        value: value,
        expiry: now.getTime() + ttl
      });
      
      // Clean up
      vi.restoreAllMocks();
    });
  });

  describe('getItemWithExpiry', () => {
    it('should return the value when item has not expired', () => {
      // Arrange
      const key = 'testKey';
      const value = 'testValue';
      const futureTime = new Date().getTime() + 10000; // 10 seconds in the future
      
      // Set up item in localStorage manually
      localStorage.setItem(`${LOCAL_KEY_PREFIX}${key}`, JSON.stringify({
        value: value,
        expiry: futureTime
      }));
      
      // Act
      const result = getItemWithExpiry(key);
      
      // Assert
      expect(result).toBe(value);
    });

    it('should return null if item does not exist', () => {
      // Arrange
      const key = 'nonExistentKey';
      
      // Act
      const result = getItemWithExpiry(key);
      
      // Assert
      expect(result).toBeNull();
    });

    it('should remove item and return null if item has expired', () => {
      // Arrange
      const key = 'expiredKey';
      const value = 'expiredValue';
      const pastTime = new Date().getTime() - 1000; // 1 second in the past
      
      // Set up expired item in localStorage manually
      localStorage.setItem(`${LOCAL_KEY_PREFIX}${key}`, JSON.stringify({
        value: value,
        expiry: pastTime
      }));
      
      // Spy on removeItem
      const removeItemSpy = vi.spyOn(localStorage, 'removeItem');
      
      // Act
      const result = getItemWithExpiry(key);
      
      // Assert
      expect(result).toBeNull();
      expect(removeItemSpy).toHaveBeenCalledWith(`${LOCAL_KEY_PREFIX}${key}`);
    });
  });

  describe('removeItem', () => {
    it('should remove an item from localStorage', () => {
      // Arrange
      const key = 'testKey';
      localStorage.setItem(`${LOCAL_KEY_PREFIX}${key}`, JSON.stringify({
        value: 'testValue',
        expiry: new Date().getTime() + 1000
      }));
      
      // Act
      removeItem(key);
      
      // Assert
      expect(localStorage.getItem(`${LOCAL_KEY_PREFIX}${key}`)).toBeNull();
    });
  });
}); 