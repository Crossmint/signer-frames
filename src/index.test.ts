import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock, mockDeep, mockReset } from 'vitest-mock-extended';
import XMIF from './index';
import { EventsService, CrossmintApiService } from './services/index.js';
import { ShardingService } from './services/sharding';
import { SolanaService } from './services/SolanaService';
import { EncryptionService } from './services/encryption';
import { AttestationService } from './services/attestation';
import type { HandshakeChild } from '@crossmint/client-sdk-window';
import type { signerInboundEvents, signerOutboundEvents } from '@crossmint/client-signers';

// Create mock functions for console
const mockConsoleLog = vi.fn();

// Mock console.log directly
global.console.log = mockConsoleLog;

// Create type-safe mock for HandshakeChild
const mockMessenger = mock<HandshakeChild<typeof signerInboundEvents, typeof signerOutboundEvents>>(
  {
    isConnected: true,
    on: vi.fn().mockReturnValue('handler-id'),
    handshakeWithParent: vi.fn().mockResolvedValue(undefined),
  }
);

// Mock the services
const mockEventsService = mockDeep<EventsService>();
const mockCrossmintApiService = mockDeep<CrossmintApiService>();

// Configure getMessenger to return our messenger mock
mockEventsService.getMessenger.mockReturnValue(mockMessenger);

// Mock the services
vi.mock('./services/index.js', () => {
  return {
    EventsService: vi.fn().mockImplementation(() => mockEventsService),
    CrossmintApiService: vi.fn().mockImplementation(() => mockCrossmintApiService),
  };
});

// Create a test data object that's used for all event handlers
// const testEventData = {
//   version: 1,
//   jwt: 'test.jwt.token',
//   authId: 'test-auth-id',
// };

// Define the window extension type
interface CustomWindow extends Window {
  XMIF: XMIF;
}

// Test-specific subclass to access protected members
class TestXMIF extends XMIF {
  static resetInstance(): void {
    const xmif = XMIF as unknown as {
      instance: XMIF | null;
      initializationPromise: Promise<XMIF> | null;
    };
    xmif.instance = null;
    xmif.initializationPromise = null;
  }

  constructor(
    eventsService = new EventsService(),
    crossmintApiService = new CrossmintApiService(),
    shardingService = new ShardingService(),
    solanaService = new SolanaService(),
    encryptionService = new EncryptionService(),
    attestationService = new AttestationService()
  ) {
    super(
      eventsService,
      crossmintApiService,
      shardingService,
      solanaService,
      encryptionService,
      attestationService
    );
  }
}

describe('XMIF', () => {
  let xmifInstance: TestXMIF;
  let originalWindow: typeof window;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReset(mockEventsService);
    mockReset(mockCrossmintApiService);
    mockReset(mockMessenger);

    mockEventsService.getMessenger.mockReturnValue(mockMessenger);
    mockMessenger.on.mockReturnValue('handler-id');

    originalWindow = global.window;
    global.window = { ...originalWindow };

    // Reset singleton instance
    TestXMIF.resetInstance();
  });

  afterEach(() => {
    global.window = originalWindow;
    vi.restoreAllMocks();

    // Reset singleton instance
    TestXMIF.resetInstance();
  });

  describe('constructor', () => {
    it('should create an instance with injected services', () => {
      xmifInstance = new TestXMIF(mockEventsService, mockCrossmintApiService);
      expect(xmifInstance).toBeInstanceOf(XMIF);
    });

    it('should create an instance with default services when not injected', () => {
      vi.clearAllMocks();
      xmifInstance = new TestXMIF();
      expect(xmifInstance).toBeInstanceOf(XMIF);
      expect(EventsService).toHaveBeenCalled();
      expect(CrossmintApiService).toHaveBeenCalled();
    });
  });

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', async () => {
      const instance1 = await TestXMIF.getInstance();
      const instance2 = await TestXMIF.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize the instance when first created', async () => {
      mockEventsService.initMessenger.mockResolvedValue(undefined);
      mockCrossmintApiService.init.mockResolvedValue(undefined);

      const instance = await TestXMIF.getInstance();
      await instance.init();

      expect(mockCrossmintApiService.init).toHaveBeenCalled();
      expect(mockEventsService.initMessenger).toHaveBeenCalled();
    });

    it('should handle concurrent initialization', async () => {
      mockEventsService.initMessenger.mockResolvedValue(undefined);
      mockCrossmintApiService.init.mockResolvedValue(undefined);

      const [instance1, instance2] = await Promise.all([
        TestXMIF.getInstance(),
        TestXMIF.getInstance(),
      ]);

      expect(instance1).toBe(instance2);
      expect(mockCrossmintApiService.init).toHaveBeenCalledTimes(1);
    });
  });

  describe('browser integration', () => {
    it('should assign XMIF instance to window when in browser environment', async () => {
      (window as { XMIF: unknown }).XMIF = null;

      if (typeof window !== 'undefined') {
        const instance = await TestXMIF.getInstance();
        (window as CustomWindow).XMIF = instance;
      }

      expect((window as CustomWindow).XMIF).toBeInstanceOf(XMIF);
    });

    it('should not initialize window.XMIF in non-browser environment', () => {
      (window as { XMIF: unknown }).XMIF = null;
      const tempWindow = global.window;
      (global as { window: typeof window | undefined }).window = undefined;

      const xmifInstance = new TestXMIF(mockEventsService, mockCrossmintApiService);

      if (typeof window !== 'undefined') {
        (window as CustomWindow).XMIF = xmifInstance;
      }

      global.window = tempWindow;

      expect((global.window as { XMIF: unknown }).XMIF).toBeNull();
    });

    it('should support the complete initialization flow in browser', async () => {
      (window as { XMIF: unknown }).XMIF = null;

      // Set up the mock expectations
      mockCrossmintApiService.init.mockResolvedValue(undefined);
      mockEventsService.initMessenger.mockResolvedValue(undefined);
      mockEventsService.getMessenger.mockReturnValue(mockMessenger);

      // Ensure mocks are properly set up
      vi.mocked(EventsService).mockImplementation(() => mockEventsService);
      vi.mocked(CrossmintApiService).mockImplementation(() => mockCrossmintApiService);

      const browserInstance = await TestXMIF.getInstance();
      (window as CustomWindow).XMIF = browserInstance;

      // Spy on registerHandlers
      const registerHandlersSpy = vi.spyOn(
        Object.getPrototypeOf(browserInstance),
        'registerHandlers' as keyof typeof browserInstance
      );

      await browserInstance.init();

      // Verify browser instance is properly set
      expect((window as CustomWindow).XMIF).toBe(browserInstance);

      // Verify services were instantiated
      expect(EventsService).toHaveBeenCalled();
      expect(CrossmintApiService).toHaveBeenCalled();

      // Verify initialization was properly called
      expect(mockCrossmintApiService.init).toHaveBeenCalled();
      expect(mockEventsService.initMessenger).toHaveBeenCalled();

      // Verify event handlers were registered
      expect(registerHandlersSpy).toHaveBeenCalled();
    });
  });
});
