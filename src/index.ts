/**
 * XMIF - Main Framework Entry Point
 */

import { combine } from 'shamir-secret-sharing';
import { EventsService, StorageService, CrossmintApiService } from './services';
import type { StorageItem, Stores } from './services/storage';
import { getPublicKey } from '@noble/ed25519';
import { base58Encode, base64Decode } from './utils';
const TMP_DEVICE_ID = '123456789';

// Define window augmentation
declare global {
  interface Window {
    XMIF: XMIF;
  }
}

/**
 * Main XMIF class
 */
class XMIF {
  // Services
  constructor(
    private readonly eventsService = new EventsService(),
    private readonly storageService = new StorageService(),
    private readonly crossmintApiService = new CrossmintApiService()
  ) {}

  /**
   * Initialize the XMIF framework
   * @returns {Promise<XMIF>} This instance for chaining
   */
  async init(): Promise<void> {
    console.log('Initializing XMIF framework...');
    console.log('-- Initializing IndexedDB...');
    await this.storageService.initDatabase();
    console.log('-- IndexedDB initialized!');
    console.log('-- Initializing events handlers...');
    await this.eventsService.initMessenger();
    this.registerHandlers();
    console.log('-- Events handlers initialized!');
  }

  /**
   * Get all items from a specified store
   * @param {Stores} storeName - The name of the object store
   * @returns {Promise<StorageItem[]>} A promise that resolves to an array of items
   */
  async listItems(storeName: Stores): Promise<StorageItem[]> {
    return this.storageService.listItems(storeName);
  }

  /**
   * Get a specific item from a store
   * @param {Stores} storeName - The name of the object store
   * @param {string} id - The ID of the item to retrieve
   * @returns {Promise<StorageItem | null>} A promise that resolves to the item or null
   */
  async getItem(storeName: Stores, id: string): Promise<StorageItem | null> {
    return this.storageService.getItem(storeName, id);
  }

  private registerHandlers() {
    const messenger = this.eventsService.getMessenger();
    messenger.on('request:create-signer', async data => {
      console.log('Received create-signer request:', data);
      const response = await this.crossmintApiService.createSigner(
        TMP_DEVICE_ID,
        {
          jwt: data.jwt,
          apiKey: data.apiKey,
        },
        {
          authId: data.authId,
        }
      );
      console.log('Response:', response);
      messenger.send('response:create-signer', {
        signerId: 'hello from the iframe',
      });
    });
    messenger.on('request:get-attestation', async data => {
      console.log('Received get-attestation request:', data);
      throw new Error('Not implemented');
    });
    messenger.on('request:sign-message', async data => {
      console.log('Received sign-message request:', data);
    });
    messenger.on('request:sign-transaction', async data => {
      console.log('Received sign-transaction request:', data);
      throw new Error('Not implemented');
    });
    messenger.on('request:send-otp', async data => {
      console.log('Received send-otp request:', data);
      const response = await this.crossmintApiService.sendOtp(
        TMP_DEVICE_ID,
        {
          jwt: data.jwt,
          apiKey: data.apiKey,
        },
        {
          otp: data.encryptedOtp,
        }
      );
      console.log('Response:', response);
      const deviceShard = response.shares.device;
      const authShard = response.shares.auth;
      // await this.storageService.storeItem(Stores.DEVICE_SHARES, {
      //   shard: deviceShard,
      //   id: TMP_DEVICE_ID,
      // });

      const privkey = await combine([base64Decode(deviceShard), base64Decode(authShard)]);
      const address = base58Encode(await getPublicKey(privkey));

      messenger.send('response:send-otp', {
        encryptedOtp: 'hello from the iframe',
        address,
      });
    });
    // messenger.on('request:get-public-key', async data => {
    //   console.log('Received get-public-key request:', data);
    //   messenger.send('response:get-public-key', {
    //     publicKey: '',
    //   });
    // });
  }
}

// Initialize when loaded as IIFE
if (typeof window !== 'undefined') {
  const xmifInstance = new XMIF();
  window.XMIF = xmifInstance;
}

// Export the XMIF class for direct usage
export default XMIF;
