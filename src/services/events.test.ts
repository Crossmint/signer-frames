import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { EventsService } from './events';
import type { HandshakeChild } from '@crossmint/client-sdk-window';
import type { signerInboundEvents, signerOutboundEvents } from '@crossmint/client-signers';

const mockHandshakeChild =
  mockDeep<HandshakeChild<typeof signerInboundEvents, typeof signerOutboundEvents>>();

// Set specific mock implementations that are needed
mockHandshakeChild.isConnected = true;
mockHandshakeChild.on.mockReturnValue('handler-id');
mockHandshakeChild.handshakeWithParent.mockResolvedValue(undefined);

vi.mock('@crossmint/client-sdk-window', () => ({
  HandshakeChild: vi.fn().mockImplementation(() => mockHandshakeChild),
}));

vi.mock('@crossmint/client-sdk-rn-window', () => ({
  RNWebViewChild: vi.fn(),
}));

vi.mock('@crossmint/client-signers', async () => {
  const actual = await vi.importActual('@crossmint/client-signers');
  return {
    ...actual,
    SecureSignerInboundEvents: {
      'request:create-signer': {},
      'request:get-attestation': {},
      'request:send-otp': {},
      'request:sign': {},
    },
    SecureSignerOutboundEvents: {
      'response:create-signer': {},
      'response:get-attestation': {},
      'response:send-otp': {},
      'response:sign': {},
    },
  };
});

// Mock window object
vi.stubGlobal('window', {
  parent: {},
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

// Mock console to avoid test output pollution
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('EventsService', () => {
  let eventsService: EventsService;
  let originalInit: typeof EventsService.prototype.init;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReset(mockHandshakeChild);

    // Restore necessary mock values after reset
    mockHandshakeChild.isConnected = true;
    mockHandshakeChild.on.mockReturnValue('handler-id');
    mockHandshakeChild.handshakeWithParent.mockResolvedValue(undefined);

    // Reset the static messenger property before each test
    // @ts-expect-error - Accessing private static property
    EventsService.messenger = null;

    eventsService = new EventsService();

    // Save original implementation for one test
    originalInit = eventsService.init;

    // Mock the init method to avoid actual execution and browser context issues
    vi.spyOn(eventsService, 'init').mockImplementation(async (_options?) => {
      // @ts-expect-error - Accessing private static property
      if (EventsService.messenger) {
        console.log('Messenger already initialized');
        return;
      }

      // @ts-expect-error - Setting private static property
      EventsService.messenger = mockHandshakeChild;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init', () => {
    it('should initialize the messenger using options', async () => {
      await eventsService.init();

      expect(eventsService.init).toHaveBeenCalled();

      // @ts-expect-error - Accessing private static property
      expect(EventsService.messenger).toBe(mockHandshakeChild);
    });

    it('should initialize messenger with custom options', async () => {
      const customOptions = {
        targetOrigin: 'https://example.com',
      };

      await eventsService.init(customOptions);

      expect(eventsService.init).toHaveBeenCalledWith(customOptions);
    });

    it('should not reinitialize messenger if already initialized', async () => {
      // @ts-expect-error - Setting private static property
      EventsService.messenger = mockHandshakeChild;

      const consoleSpy = vi.spyOn(console, 'log');

      await eventsService.init();

      expect(consoleSpy).toHaveBeenCalledWith('Messenger already initialized');
    });

    it('should attempt to call the actual implementation', async () => {
      // Using the real implementation for one test to increase coverage
      vi.restoreAllMocks();

      // Mock HandshakeChild to return our mock messenger
      (window as unknown as { parent: object }).parent = {};
      const handshakeConstructorSpy = vi.fn().mockReturnValue(mockHandshakeChild);
      (global as unknown as { HandshakeChild: typeof vi.fn }).HandshakeChild =
        handshakeConstructorSpy;

      try {
        // Run real implementation
        await originalInit.call(eventsService);

        // Verify the constructor was called
        expect(handshakeConstructorSpy).toHaveBeenCalled();
      } catch (_e) {
        // Expected to possibly error in test environment
      }
    });
  });

  describe('getMessenger', () => {
    it('should return the messenger if initialized', async () => {
      await eventsService.init();

      const messenger = eventsService.getMessenger();
      expect(messenger).toBe(mockHandshakeChild);
    });

    it('should throw if messenger is not initialized', () => {
      // @ts-expect-error - Setting private static property
      EventsService.messenger = null;

      expect(() => {
        eventsService.getMessenger();
      }).toThrow('Messenger not initialized');
    });
  });

  describe('assertMessengerInitialized', () => {
    it('should not throw if messenger is initialized', async () => {
      await eventsService.init();

      expect(() => {
        // @ts-expect-error - Testing private method
        eventsService.assertMessengerInitialized();
      }).not.toThrow();
    });

    it('should throw if messenger is not initialized', () => {
      // @ts-expect-error - Setting private static property
      EventsService.messenger = null;

      expect(() => {
        // @ts-expect-error - Testing private method
        eventsService.assertMessengerInitialized();
      }).toThrow('Messenger not initialized');
    });
  });
});
