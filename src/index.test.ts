import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock, mockDeep, mockReset } from 'vitest-mock-extended';
import XMIF from './index';
import { EventsService, StorageService, CrossmintApiService } from './services/index.js';
import type { HandshakeChild } from '@crossmint/client-sdk-window';
import type {
  SecureSignerInboundEvents,
  SecureSignerOutboundEvents,
} from '@crossmint/client-signers';

// Define handler function type for events
type EventHandler = (data: Record<string, unknown>) => Promise<unknown>;

// Create mock functions for console
const mockConsoleLog = vi.fn();

// Mock console.log directly
global.console.log = mockConsoleLog;

// Create type-safe mock for HandshakeChild
const mockMessenger = mock<
  HandshakeChild<typeof SecureSignerInboundEvents, typeof SecureSignerOutboundEvents>
>({
  isConnected: true,
  on: vi.fn().mockReturnValue('handler-id'),
  handshakeWithParent: vi.fn().mockResolvedValue(undefined),
});

// Mock the services
const mockEventsService = mockDeep<EventsService>();
const mockStorageService = mockDeep<StorageService>();
const mockCrossmintApiService = mockDeep<CrossmintApiService>();

// Configure getMessenger to return our messenger mock
mockEventsService.getMessenger.mockReturnValue(mockMessenger);

// Mock the services
vi.mock('./services/index.js', () => {
  return {
    EventsService: vi.fn().mockImplementation(() => mockEventsService),
    StorageService: vi.fn().mockImplementation(() => mockStorageService),
    CrossmintApiService: vi.fn().mockImplementation(() => mockCrossmintApiService),
  };
});

// Create a test data object that's used for all event handlers
const testEventData = {
  version: 1,
  jwt: 'test.jwt.token',
  authId: 'test-auth-id',
};

// Define the window extension type
interface CustomWindow extends Window {
  XMIF: XMIF;
}

describe('XMIF', () => {
  let xmifInstance: XMIF;
  let originalWindow: typeof window;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReset(mockEventsService);
    mockReset(mockStorageService);
    mockReset(mockCrossmintApiService);
    mockReset(mockMessenger);

    mockStorageService.initDatabase.mockResolvedValue({} as IDBDatabase);

    mockEventsService.getMessenger.mockReturnValue(mockMessenger);
    mockMessenger.on.mockReturnValue('handler-id');

    originalWindow = global.window;

    global.window = { ...originalWindow };

    xmifInstance = new XMIF(mockEventsService, mockStorageService, mockCrossmintApiService);
  });

  afterEach(() => {
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with injected services', () => {
      expect(xmifInstance).toBeInstanceOf(XMIF);
    });

    it('should create an instance with default services when not injected', () => {
      vi.clearAllMocks();

      const defaultInstance = new XMIF();

      expect(defaultInstance).toBeInstanceOf(XMIF);
      expect(EventsService).toHaveBeenCalled();
      expect(StorageService).toHaveBeenCalled();
      expect(CrossmintApiService).toHaveBeenCalled();
    });
  });

  describe('init', () => {
    it('should initialize services in the correct order', async () => {
      mockStorageService.initDatabase.mockResolvedValue({} as IDBDatabase);
      mockEventsService.initMessenger.mockResolvedValue(undefined);

      await xmifInstance.init();

      expect(mockStorageService.initDatabase).toHaveBeenCalled();
      expect(mockEventsService.initMessenger).toHaveBeenCalled();

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(calls).toContain('Initializing XMIF framework...');
      expect(calls).toContain('-- Initializing IndexedDB...');
      expect(calls).toContain('-- IndexedDB initialized!');
      expect(calls).toContain('-- Initializing events handlers...');
      expect(calls).toContain('-- Events handlers initialized!');

      expect(calls.indexOf('-- Initializing IndexedDB...')).toBeLessThan(
        calls.indexOf('-- IndexedDB initialized!')
      );
      expect(calls.indexOf('-- IndexedDB initialized!')).toBeLessThan(
        calls.indexOf('-- Initializing events handlers...')
      );
      expect(calls.indexOf('-- Initializing events handlers...')).toBeLessThan(
        calls.indexOf('-- Events handlers initialized!')
      );
    });

    it('should call registerHandlers during initialization', async () => {
      const registerHandlersSpy = vi.spyOn(
        Object.getPrototypeOf(xmifInstance),
        'registerHandlers' as keyof typeof xmifInstance
      );

      await xmifInstance.init();

      expect(registerHandlersSpy).toHaveBeenCalled();
    });
  });

  describe('registerHandlers', () => {
    it('should register all event handlers', async () => {
      await xmifInstance.init();

      expect(mockMessenger.on).toHaveBeenCalledWith('request:create-signer', expect.any(Function));
      expect(mockMessenger.on).toHaveBeenCalledWith(
        'request:get-attestation',
        expect.any(Function)
      );
      expect(mockMessenger.on).toHaveBeenCalledWith('request:sign-message', expect.any(Function));
      expect(mockMessenger.on).toHaveBeenCalledWith(
        'request:sign-transaction',
        expect.any(Function)
      );
      expect(mockMessenger.on).toHaveBeenCalledWith('request:send-otp', expect.any(Function));
    });

    it('should throw errors when handlers are not implemented', async () => {
      let createSignerHandler: EventHandler | undefined;
      mockMessenger.on.mockImplementation((event, handler) => {
        if (event === 'request:create-signer') {
          createSignerHandler = handler as EventHandler;
        }
        return 'handler-id';
      });

      await xmifInstance.init();

      expect(createSignerHandler).toBeDefined();

      if (createSignerHandler) {
        await expect(createSignerHandler(testEventData)).rejects.toThrow('Not implemented');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Received create-signer request:',
          expect.anything()
        );
      }
    });

    it('should throw errors for all other event handlers', async () => {
      const handlers: Record<string, EventHandler> = {};
      const events = [
        'request:get-attestation',
        'request:sign-message',
        'request:sign-transaction',
        'request:send-otp',
      ];

      mockMessenger.on.mockImplementation((event, handler) => {
        handlers[event as string] = handler as EventHandler;
        return 'handler-id';
      });

      await xmifInstance.init();

      for (const event of events) {
        expect(handlers[event]).toBeDefined();
        await expect(handlers[event](testEventData)).rejects.toThrow('Not implemented');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          `Received ${event.split(':')[1]} request:`,
          expect.anything()
        );
      }
    });
  });

  describe('browser integration', () => {
    it('should assign XMIF instance to window when in browser environment', () => {
      (window as { XMIF: unknown }).XMIF = null;

      if (typeof window !== 'undefined') {
        const xmifInstance = new XMIF();
        (window as CustomWindow).XMIF = xmifInstance;
      }

      expect((window as CustomWindow).XMIF).toBeInstanceOf(XMIF);
    });

    it('should not initialize window.XMIF in non-browser environment', () => {
      (window as { XMIF: unknown }).XMIF = null;
      const tempWindow = global.window;
      (global as { window: typeof window | undefined }).window = undefined;

      const xmifInstance = new XMIF(mockEventsService, mockStorageService, mockCrossmintApiService);

      if (typeof window !== 'undefined') {
        (window as CustomWindow).XMIF = xmifInstance;
      }

      global.window = tempWindow;

      expect((global.window as { XMIF: unknown }).XMIF).toBeNull();
    });

    it('should support the complete initialization flow in browser', async () => {
      (window as { XMIF: unknown }).XMIF = null;

      mockStorageService.initDatabase.mockResolvedValue({} as IDBDatabase);
      mockEventsService.initMessenger.mockResolvedValue(undefined);
      mockEventsService.getMessenger.mockReturnValue(mockMessenger);

      const originalEventService = EventsService;
      const originalStorageService = StorageService;
      const originalCrossmintApiService = CrossmintApiService;

      vi.mocked(EventsService).mockImplementation(() => mockEventsService);
      vi.mocked(StorageService).mockImplementation(() => mockStorageService);
      vi.mocked(CrossmintApiService).mockImplementation(() => mockCrossmintApiService);

      const browserInstance = new XMIF();
      (window as CustomWindow).XMIF = browserInstance;

      await browserInstance.init();

      expect((window as CustomWindow).XMIF).toBe(browserInstance);
      expect(EventsService).toHaveBeenCalled();
      expect(StorageService).toHaveBeenCalled();
      expect(CrossmintApiService).toHaveBeenCalled();
    });
  });
});
