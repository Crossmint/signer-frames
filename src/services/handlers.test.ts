// import { describe, it, expect, vi, beforeEach } from 'vitest';
// import {
//   CreateSignerEventHandler,
//   SendOtpEventHandler,
//   GetPublicKeyEventHandler,
//   SignMessageEventHandler,
//   SignTransactionEventHandler,
// } from './handlers';
// import { mockDeep, mockReset } from 'vitest-mock-extended';
// import type { CrossmintApiService } from './api';
// import type { ShardingService } from './sharding-service';
// import type { SignerInputEvent } from '@crossmint/client-signers';
// import type { Ed25519Service } from './ed25519';

// // Mock dependencies first, before any variable references
// vi.mock('../utils', () => ({
//   base64Decode: vi.fn().mockImplementation(() => new Uint8Array([1, 2, 3, 4])),
//   base58Encode: vi.fn().mockReturnValue('encoded-transaction'),
//   base58Decode: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4])),
// }));

// // Mock @solana/web3.js without using any variables defined in this file
// vi.mock('@solana/web3.js', async () => {
//   const mockPublicKey = {
//     equals: vi.fn().mockReturnValue(true),
//     toBase58: vi.fn().mockReturnValue('mock-public-key'),
//   };

//   const mockKeypair = {
//     publicKey: mockPublicKey,
//     secretKey: new Uint8Array(64).fill(1),
//   };

//   const mockTransaction = {
//     message: {
//       staticAccountKeys: [mockPublicKey],
//     },
//     sign: vi.fn(),
//     serialize: vi.fn().mockReturnValue(new Uint8Array([5, 6, 7, 8])),
//     signatures: ['test-signature'],
//   };

//   return {
//     Keypair: {
//       generate: vi.fn().mockReturnValue(mockKeypair),
//       fromSecretKey: vi.fn().mockReturnValue(mockKeypair),
//     },
//     PublicKey: vi.fn().mockImplementation(() => mockPublicKey),
//     VersionedTransaction: {
//       deserialize: vi.fn().mockReturnValue(mockTransaction),
//     },
//     SystemProgram: {
//       transfer: vi.fn().mockReturnValue({}),
//     },
//     TransactionMessage: vi.fn().mockImplementation(() => ({
//       compileToV0Message: vi.fn().mockReturnValue({}),
//     })),
//   };
// });

// // Now import mocked modules
// // import { base58Decode, base58Encode, base64Decode } from '../utils';

// // Define common test data
// const testDeviceId = 'test-device-id';
// const testAuthData = {
//   jwt: 'test-jwt',
//   apiKey: 'test-api-key',
// };
// const testPublicKey = 'test-public-key';
// const testPrivateKey = new Uint8Array(32).fill(1);

// describe('EventHandlers', () => {
//   // Mock dependencies
//   const mockCrossmintApiService = mockDeep<CrossmintApiService>();
//   const mockShardingService = mockDeep<ShardingService>();
//   const mockEd25519Service = mockDeep<Ed25519Service>();

//   // Reset mocks before each test
//   beforeEach(() => {
//     mockReset(mockCrossmintApiService);
//     mockReset(mockShardingService);
//     mockReset(mockEd25519Service);
//     vi.clearAllMocks();

//     // Mock console.log to avoid clutter in test output
//     vi.spyOn(console, 'log').mockImplementation(() => {});
//   });

//   describe('BaseEventHandler', () => {
//     it('should measure function execution time in callback', async () => {
//       const handler = new CreateSignerEventHandler(mockCrossmintApiService);
//       const testInput: SignerInputEvent<'create-signer'> = {
//         deviceId: testDeviceId,
//         authData: testAuthData,
//         data: { authId: 'test-auth-id' },
//       };

//       mockCrossmintApiService.createSigner.mockResolvedValue({} as Response);
//       const spy = vi.spyOn(handler, 'handler');

//       await handler.callback(testInput);

//       expect(spy).toHaveBeenCalledWith(testInput);
//       expect(console.log).toHaveBeenCalled();
//     });
//   });

//   describe('CreateSignerEventHandler', () => {
//     it('should have correct event names', () => {
//       const handler = new CreateSignerEventHandler(mockCrossmintApiService);
//       expect(handler.event).toBe('request:create-signer');
//       expect(handler.responseEvent).toBe('response:create-signer');
//     });

//     it('should call createSigner with correct parameters', async () => {
//       const handler = new CreateSignerEventHandler(mockCrossmintApiService);
//       const testInput: SignerInputEvent<'create-signer'> = {
//         deviceId: testDeviceId,
//         authData: testAuthData,
//         data: { authId: 'test-auth-id' },
//       };

//       mockCrossmintApiService.createSigner.mockResolvedValue({} as Response);

//       const result = await handler.handler(testInput);

//       expect(mockCrossmintApiService.createSigner).toHaveBeenCalledWith(
//         testDeviceId,
//         testAuthData,
//         { authId: 'test-auth-id' }
//       );
//       expect(result).toEqual({});
//     });
//   });

//   describe('SendOtpEventHandler', () => {
//     it('should have correct event names', () => {
//       const handler = new SendOtpEventHandler(mockCrossmintApiService, mockShardingService);
//       expect(handler.event).toBe('request:send-otp');
//       expect(handler.responseEvent).toBe('response:send-otp');
//     });

//     it('should process OTP and store key shards', async () => {
//       const handler = new SendOtpEventHandler(mockCrossmintApiService, mockShardingService);
//       const testInput: SignerInputEvent<'send-otp'> = {
//         deviceId: testDeviceId,
//         authData: testAuthData,
//         data: {
//           encryptedOtp: '123456',
//           chainLayer: 'solana',
//         },
//       };

//       const mockedResponse = {
//         shares: {
//           device: 'device-share-base64',
//           auth: 'auth-share-base64',
//         },
//       };

//       mockCrossmintApiService.sendOtp.mockResolvedValue(mockedResponse);
//       mockShardingService.recombineShards.mockResolvedValue({
//         privateKey: testPrivateKey,
//         publicKey: testPublicKey,
//       });

//       const result = await handler.handler(testInput);

//       expect(mockCrossmintApiService.sendOtp).toHaveBeenCalledWith(testDeviceId, testAuthData, {
//         otp: '123456',
//       });

//       expect(mockShardingService.storeDeviceKeyShardLocally).toHaveBeenCalledWith({
//         deviceId: testDeviceId,
//         data: 'device-share-base64',
//       });

//       expect(mockShardingService.storeAuthKeyShardLocally).toHaveBeenCalledWith({
//         deviceId: testDeviceId,
//         data: 'auth-share-base64',
//       });

//       // This function should now receive Uint8Arrays from base64Decode
//       expect(mockShardingService.recombineShards).toHaveBeenCalledWith(
//         expect.any(Uint8Array),
//         expect.any(Uint8Array),
//         'solana'
//       );

//       expect(result).toEqual({ address: testPublicKey });
//     });
//   });

//   describe('GetPublicKeyEventHandler', () => {
//     it('should have correct event names', () => {
//       const handler = new GetPublicKeyEventHandler(mockShardingService);
//       expect(handler.event).toBe('request:get-public-key');
//       expect(handler.responseEvent).toBe('response:get-public-key');
//     });

//     it('should retrieve and reconstruct the key', async () => {
//       const handler = new GetPublicKeyEventHandler(mockShardingService);
//       const testInput: SignerInputEvent<'get-public-key'> = {
//         deviceId: testDeviceId,
//         authData: testAuthData,
//         data: {
//           chainLayer: 'solana',
//         },
//       };

//       // Update mock to match the new implementation
//       mockShardingService.getLocalKeyInstance.mockResolvedValue({
//         privateKey: testPrivateKey,
//         publicKey: testPublicKey,
//       });

//       const result = await handler.handler(testInput);

//       expect(mockShardingService.getLocalKeyInstance).toHaveBeenCalledWith(
//         testDeviceId,
//         testAuthData,
//         'solana'
//       );

//       expect(result).toEqual({ publicKey: testPublicKey });
//     });
//   });

//   describe('SignMessageEventHandler', () => {
//     it('should have correct event names', () => {
//       const handler = new SignMessageEventHandler(mockShardingService, mockEd25519Service);
//       expect(handler.event).toBe('request:sign-message');
//       expect(handler.responseEvent).toBe('response:sign-message');
//     });

//     it('should sign a message for supported chain layers', async () => {
//       const handler = new SignMessageEventHandler(mockShardingService, mockEd25519Service);
//       const testInput: SignerInputEvent<'sign-message'> = {
//         deviceId: testDeviceId,
//         authData: testAuthData,
//         data: {
//           chainLayer: 'solana',
//           message: 'test message',
//           encoding: 'base58',
//         },
//       };

//       mockShardingService.getLocalKeyInstance.mockResolvedValue({
//         privateKey: testPrivateKey,
//         publicKey: testPublicKey,
//       });

//       mockEd25519Service.signMessage.mockResolvedValue('test-signature');

//       const result = await handler.handler(testInput);

//       expect(mockShardingService.getLocalKeyInstance).toHaveBeenCalledWith(
//         testDeviceId,
//         testAuthData,
//         'solana'
//       );

//       expect(mockEd25519Service.signMessage).toHaveBeenCalledWith('test message', testPrivateKey);

//       expect(result).toEqual({
//         signature: 'test-signature',
//         publicKey: testPublicKey,
//       });
//     });

//     it('should throw "Not implemented" error for unsupported chain layers', async () => {
//       const handler = new SignMessageEventHandler(mockShardingService, mockEd25519Service);
//       const testInput: SignerInputEvent<'sign-message'> = {
//         deviceId: testDeviceId,
//         authData: testAuthData,
//         data: {
//           chainLayer: 'evm', // Use EVM to trigger the 'not implemented' error
//           message: 'test message', // Use a string message
//           encoding: 'base58', // Add required encoding property
//         },
//       };

//       mockShardingService.getLocalKeyInstance.mockResolvedValue({
//         privateKey: testPrivateKey,
//         publicKey: testPublicKey,
//       });

//       await expect(handler.handler(testInput)).rejects.toThrow('Chain layer not implemented');
//     });
//   });

//   describe('SignTransactionEventHandler', () => {
//     const serializedTransaction = 'base58-encoded-transaction';

//     beforeEach(() => {
//       mockShardingService.getLocalKeyInstance.mockResolvedValue({
//         privateKey: testPrivateKey,
//         publicKey: testPublicKey,
//       });
//     });

//     it('should have correct event names', () => {
//       const handler = new SignTransactionEventHandler(mockShardingService, mockEd25519Service);
//       expect(handler.event).toBe('request:sign-transaction');
//       expect(handler.responseEvent).toBe('response:sign-transaction');
//     });

//     it('should sign the transaction', async () => {
//       const handler = new SignTransactionEventHandler(mockShardingService, mockEd25519Service);
//       const testInput: SignerInputEvent<'sign-transaction'> = {
//         deviceId: testDeviceId,
//         authData: testAuthData,
//         data: {
//           transaction: serializedTransaction,
//           chainLayer: 'solana',
//           encoding: 'base58',
//         },
//       };

//       const result = await handler.handler(testInput);

//       expect(mockShardingService.getLocalKeyInstance).toHaveBeenCalledWith(
//         testDeviceId,
//         testAuthData,
//         'solana'
//       );

//       expect(result).toEqual({
//         publicKey: testPublicKey,
//         transaction: 'encoded-transaction',
//         signature: 'encoded-transaction',
//       });
//     });
//   });
// });
