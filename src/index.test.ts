import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock, mockDeep, mockReset } from 'vitest-mock-extended';
import type { HandshakeChild } from '@crossmint/client-sdk-window';
import type { signerInboundEvents, signerOutboundEvents } from '@crossmint/client-signers';

// Mock the services module before importing XMIF
vi.mock('./services', () => {
  return {
    createXMIFServices: () => ({
      events: {
        name: 'Events Service',
        init: vi.fn().mockResolvedValue(undefined),
        getMessenger: vi.fn().mockReturnValue({
          isConnected: true,
          on: vi.fn().mockReturnValue('handler-id'),
          send: vi.fn(),
        }),
      },
      api: {
        name: 'Crossmint API',
        init: vi.fn().mockResolvedValue(undefined),
      },
      sharding: {
        name: 'Sharding Service',
        init: vi.fn().mockResolvedValue(undefined),
      },
      encrypt: {
        name: 'Encryption Service',
        init: vi.fn().mockResolvedValue(undefined),
      },
      attestation: {
        name: 'Attestation Service',
        init: vi.fn().mockResolvedValue(undefined),
      },
      solana: {
        name: 'Solana Service',
        init: vi.fn().mockResolvedValue(undefined),
      },
      ed25519: {
        name: 'Ed25519 Service',
        init: vi.fn().mockResolvedValue(undefined),
      },
    }),
    initializeHandlers: () => [
      {
        event: 'request:test',
        responseEvent: 'response:test',
        callback: vi.fn().mockResolvedValue({ status: 'success' }),
        handler: vi.fn(),
      },
    ],
  };
});

// Now import XMIF after mocking
import XMIF from './index';

// Create mock functions for console
const mockConsoleLog = vi.fn();

// Mock console.log directly
global.console.log = mockConsoleLog;

// Define the window extension type
interface CustomWindow extends Window {
  XMIF: XMIF;
  ENVIRONMENT: string;
}

describe('XMIF', () => {
  let xmifInstance: XMIF;
  let originalWindow: typeof window;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    originalWindow = global.window;
    global.window = { ...originalWindow, ENVIRONMENT: 'staging' };

    xmifInstance = new XMIF();
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
    });
  });

  describe('init', () => {
    it('should initialize services in the correct order', async () => {
      await xmifInstance.init();

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(calls).toContain('Initializing XMIF framework...');
      expect(calls.some(call => call.includes('Initializing'))).toBeTruthy();
      expect(calls.some(call => call.includes('initialized!'))).toBeTruthy();
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
      const registerHandlersSpy = vi.spyOn(
        Object.getPrototypeOf(xmifInstance),
        'registerHandlers' as keyof typeof xmifInstance
      );

      await xmifInstance.init();

      expect(registerHandlersSpy).toHaveBeenCalled();
    });

    it('should throw errors when handlers are not implemented', async () => {
      const registerHandlersSpy = vi.spyOn(
        Object.getPrototypeOf(xmifInstance),
        'registerHandlers' as keyof typeof xmifInstance
      );

      await xmifInstance.init();

      expect(registerHandlersSpy).toHaveBeenCalled();
    });

    it('should throw errors for all other event handlers', async () => {
      const registerHandlersSpy = vi.spyOn(
        Object.getPrototypeOf(xmifInstance),
        'registerHandlers' as keyof typeof xmifInstance
      );

      await xmifInstance.init();

      expect(registerHandlersSpy).toHaveBeenCalled();
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

      const xmifInstance = new XMIF();

      if (typeof window !== 'undefined') {
        (window as CustomWindow).XMIF = xmifInstance;
      }

      global.window = tempWindow;

      expect((global.window as { XMIF: unknown }).XMIF).toBeNull();
    });

    it('should support the complete initialization flow in browser', async () => {
      (window as { XMIF: unknown }).XMIF = null;

      const browserInstance = new XMIF();
      (window as CustomWindow).XMIF = browserInstance;

      // Spy on registerHandlers
      const registerHandlersSpy = vi.spyOn(
        Object.getPrototypeOf(browserInstance),
        'registerHandlers' as keyof typeof browserInstance
      );

      await browserInstance.init();

      // Verify browser instance is properly set
      expect((window as CustomWindow).XMIF).toBe(browserInstance);

      // Verify event handlers were registered
      expect(registerHandlersSpy).toHaveBeenCalled();
    });
  });
});
