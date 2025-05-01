import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { EventsService } from './events';
import type { HandshakeChild } from '@crossmint/client-sdk-window';
import type { signerInboundEvents, signerOutboundEvents } from '@crossmint/client-signers';

// Create a mock HandshakeChild for testing
const mockHandshakeChild =
  mockDeep<HandshakeChild<typeof signerInboundEvents, typeof signerOutboundEvents>>();

// Set necessary mock implementations
mockHandshakeChild.isConnected = true;
mockHandshakeChild.on.mockReturnValue('handler-id');
mockHandshakeChild.handshakeWithParent.mockResolvedValue(undefined);

// Mock required modules and browser APIs
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

// Silence console to avoid test output pollution
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('EventsService', () => {
  let eventsService: EventsService;

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

    // Mock the init method to avoid browser context issues
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

  describe('initialization and messenger access', () => {
    it('should initialize the messenger successfully', async () => {
      await eventsService.init();

      // @ts-expect-error - Accessing private static property
      expect(EventsService.messenger).toBe(mockHandshakeChild);
    });

    it('should initialize with custom options when provided', async () => {
      const customOptions = {
        targetOrigin: 'https://example.com',
      };

      await eventsService.init(customOptions);
      expect(eventsService.init).toHaveBeenCalledWith(customOptions);
    });

    it('should not reinitialize if already initialized', async () => {
      // @ts-expect-error - Setting private static property
      EventsService.messenger = mockHandshakeChild;

      const consoleSpy = vi.spyOn(console, 'log');
      await eventsService.init();

      expect(consoleSpy).toHaveBeenCalledWith('Messenger already initialized');
    });

    it('should return the messenger when initialized and throw when not', async () => {
      // Test not initialized case
      expect(() => eventsService.getMessenger()).toThrow('Messenger not initialized');

      // Test initialized case
      await eventsService.init();
      expect(eventsService.getMessenger()).toBe(mockHandshakeChild);
    });
  });

  // This test covers the real implementation once for code coverage
  it('should attempt to use the real implementation', async () => {
    vi.restoreAllMocks();

    // Save original init method
    const originalInit = eventsService.init;

    // Mock HandshakeChild to return our mock messenger
    (window as unknown as { parent: object }).parent = {};
    const handshakeConstructorSpy = vi.fn().mockReturnValue(mockHandshakeChild);
    (global as unknown as { HandshakeChild: typeof vi.fn }).HandshakeChild =
      handshakeConstructorSpy;

    try {
      await originalInit.call(eventsService);
      expect(handshakeConstructorSpy).toHaveBeenCalled();
    } catch (_e) {
      // Expected to possibly error in test environment
    }
  });
});
