// import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// import { mock, mockDeep, mockReset } from "vitest-mock-extended";
// import XMIF from "./index";
// import { EventsService, CrossmintApiService } from "./services/index.js";
// import type { HandshakeChild } from "@crossmint/client-sdk-window";
// import type {
// 	signerInboundEvents,
// 	signerOutboundEvents,
// } from "@crossmint/client-signers";

// // Create mock functions for console
// const mockConsoleLog = vi.fn();

// // Mock console.log directly
// global.console.log = mockConsoleLog;

// // Create type-safe mock for HandshakeChild
// const mockMessenger = mock<
// 	HandshakeChild<typeof signerInboundEvents, typeof signerOutboundEvents>
// >({
// 	isConnected: true,
// 	on: vi.fn().mockReturnValue("handler-id"),
// 	handshakeWithParent: vi.fn().mockResolvedValue(undefined),
// });

// // Mock the services
// const mockEventsService = mockDeep<EventsService>();
// const mockCrossmintApiService = mockDeep<CrossmintApiService>();

// // Configure getMessenger to return our messenger mock
// mockEventsService.getMessenger.mockReturnValue(mockMessenger);

// // Mock the services
// vi.mock("./services/index.js", () => {
// 	return {
// 		EventsService: vi.fn().mockImplementation(() => mockEventsService),
// 		CrossmintApiService: vi
// 			.fn()
// 			.mockImplementation(() => mockCrossmintApiService),
// 	};
// });

// // Create a test data object that's used for all event handlers
// // const testEventData = {
// //   version: 1,
// //   jwt: 'test.jwt.token',
// //   authId: 'test-auth-id',
// // };

// // Define the window extension type
// interface CustomWindow extends Window {
// 	XMIF: XMIF;
// }

// describe("XMIF", () => {
// 	let xmifInstance: XMIF;
// 	let originalWindow: typeof window;

// 	beforeEach(() => {
// 		vi.clearAllMocks();
// 		mockReset(mockEventsService);
// 		mockReset(mockCrossmintApiService);
// 		mockReset(mockMessenger);

// 		mockEventsService.getMessenger.mockReturnValue(mockMessenger);
// 		mockMessenger.on.mockReturnValue("handler-id");

// 		originalWindow = global.window;

// 		global.window = { ...originalWindow };

// 		xmifInstance = new XMIF(mockEventsService, mockCrossmintApiService);
// 	});

// 	afterEach(() => {
// 		global.window = originalWindow;
// 		vi.restoreAllMocks();
// 	});

// 	describe("constructor", () => {
// 		it("should create an instance with injected services", () => {
// 			expect(xmifInstance).toBeInstanceOf(XMIF);
// 		});

// 		it("should create an instance with default services when not injected", () => {
// 			vi.clearAllMocks();

// 			const defaultInstance = new XMIF();

// 			expect(defaultInstance).toBeInstanceOf(XMIF);
// 			expect(EventsService).toHaveBeenCalled();
// 			expect(CrossmintApiService).toHaveBeenCalled();
// 		});
// 	});

// 	describe("init", () => {
// 		it("should initialize services in the correct order", async () => {
// 			mockStorageService.initDatabase.mockResolvedValue({} as IDBDatabase);
// 			mockEventsService.initMessenger.mockResolvedValue(undefined);
// 			mockCrossmintApiService.init.mockResolvedValue(undefined);

// 			await xmifInstance.init();

// 			expect(mockStorageService.initDatabase).toHaveBeenCalled();
// 			expect(mockCrossmintApiService.init).toHaveBeenCalled();
// 			expect(mockEventsService.initMessenger).toHaveBeenCalled();

// 			const calls = mockConsoleLog.mock.calls.map((call) => call[0]);
// 			expect(calls).toContain("Initializing XMIF framework...");
// 			expect(calls).toContain("-- Initializing IndexedDB client...");
// 			expect(calls).toContain("-- IndexedDB client initialized!");
// 			expect(calls).toContain("-- Initializing Crossmint API...");
// 			expect(calls).toContain("-- Crossmint API initialized!");
// 			expect(calls).toContain("-- Initializing events handlers...");
// 			expect(calls).toContain("-- Events handlers initialized!");

// 			expect(calls.indexOf("-- Initializing IndexedDB client...")).toBeLessThan(
// 				calls.indexOf("-- IndexedDB client initialized!"),
// 			);
// 			expect(calls.indexOf("-- IndexedDB client initialized!")).toBeLessThan(
// 				calls.indexOf("-- Initializing Crossmint API..."),
// 			);
// 			expect(calls.indexOf("-- Initializing Crossmint API...")).toBeLessThan(
// 				calls.indexOf("-- Crossmint API initialized!"),
// 			);
// 			expect(calls.indexOf("-- Crossmint API initialized!")).toBeLessThan(
// 				calls.indexOf("-- Initializing events handlers..."),
// 			);
// 			expect(calls.indexOf("-- Initializing events handlers...")).toBeLessThan(
// 				calls.indexOf("-- Events handlers initialized!"),
// 			);
// 		});

// 		it("should call registerHandlers during initialization", async () => {
// 			const registerHandlersSpy = vi.spyOn(
// 				Object.getPrototypeOf(xmifInstance),
// 				"registerHandlers" as keyof typeof xmifInstance,
// 			);

// 			await xmifInstance.init();

// 			expect(registerHandlersSpy).toHaveBeenCalled();
// 		});
// 	});

// 	describe("registerHandlers", () => {
// 		it("should register all event handlers", async () => {
// 			const registerHandlersSpy = vi.spyOn(
// 				Object.getPrototypeOf(xmifInstance),
// 				"registerHandlers" as keyof typeof xmifInstance,
// 			);

// 			await xmifInstance.init();

// 			expect(registerHandlersSpy).toHaveBeenCalled();
// 		});

// 		it("should throw errors when handlers are not implemented", async () => {
// 			const registerHandlersSpy = vi.spyOn(
// 				Object.getPrototypeOf(xmifInstance),
// 				"registerHandlers" as keyof typeof xmifInstance,
// 			);

// 			await xmifInstance.init();

// 			expect(registerHandlersSpy).toHaveBeenCalled();
// 		});

// 		it("should throw errors for all other event handlers", async () => {
// 			const registerHandlersSpy = vi.spyOn(
// 				Object.getPrototypeOf(xmifInstance),
// 				"registerHandlers" as keyof typeof xmifInstance,
// 			);

// 			await xmifInstance.init();

// 			expect(registerHandlersSpy).toHaveBeenCalled();
// 		});
// 	});

// 	describe("browser integration", () => {
// 		it("should assign XMIF instance to window when in browser environment", () => {
// 			(window as { XMIF: unknown }).XMIF = null;

// 			if (typeof window !== "undefined") {
// 				const xmifInstance = new XMIF();
// 				(window as CustomWindow).XMIF = xmifInstance;
// 			}

// 			expect((window as CustomWindow).XMIF).toBeInstanceOf(XMIF);
// 		});

// 		it("should not initialize window.XMIF in non-browser environment", () => {
// 			(window as { XMIF: unknown }).XMIF = null;
// 			const tempWindow = global.window;
// 			(global as { window: typeof window | undefined }).window = undefined;

// 			const xmifInstance = new XMIF(mockEventsService, mockCrossmintApiService);

// 			if (typeof window !== "undefined") {
// 				(window as CustomWindow).XMIF = xmifInstance;
// 			}

// 			global.window = tempWindow;

// 			expect((global.window as { XMIF: unknown }).XMIF).toBeNull();
// 		});

// 		it("should support the complete initialization flow in browser", async () => {
// 			(window as { XMIF: unknown }).XMIF = null;

// 			// Set up the mock expectations
// 			mockStorageService.initDatabase.mockResolvedValue({} as IDBDatabase);
// 			mockCrossmintApiService.init.mockResolvedValue(undefined);
// 			mockEventsService.initMessenger.mockResolvedValue(undefined);
// 			mockEventsService.getMessenger.mockReturnValue(mockMessenger);

// 			// Ensure mocks are properly set up
// 			vi.mocked(EventsService).mockImplementation(() => mockEventsService);
// 			vi.mocked(StorageService).mockImplementation(() => mockStorageService);
// 			vi.mocked(CrossmintApiService).mockImplementation(
// 				() => mockCrossmintApiService,
// 			);

// 			const browserInstance = new XMIF();
// 			(window as CustomWindow).XMIF = browserInstance;

// 			// Spy on registerHandlers
// 			const registerHandlersSpy = vi.spyOn(
// 				Object.getPrototypeOf(browserInstance),
// 				"registerHandlers" as keyof typeof browserInstance,
// 			);

// 			await browserInstance.init();

// 			// Verify browser instance is properly set
// 			expect((window as CustomWindow).XMIF).toBe(browserInstance);

// 			// Verify services were instantiated
// 			expect(EventsService).toHaveBeenCalled();
// 			expect(StorageService).toHaveBeenCalled();
// 			expect(CrossmintApiService).toHaveBeenCalled();

// 			// Verify initialization was properly called
// 			expect(mockStorageService.initDatabase).toHaveBeenCalled();
// 			expect(mockCrossmintApiService.init).toHaveBeenCalled();
// 			expect(mockEventsService.initMessenger).toHaveBeenCalled();

// 			// Verify event handlers were registered
// 			expect(registerHandlersSpy).toHaveBeenCalled();
// 		});
// 	});
// });
