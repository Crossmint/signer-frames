import { expect, describe, it, beforeEach, vi } from 'vitest';
import { EncryptionService } from './encryption';
import { DhkemP384HkdfSha384 } from '@hpke/core';

describe('EncryptionService', () => {
  let senderEncryptionService: EncryptionService;
  let receiverEncryptionService: EncryptionService;
  let receiverPublicKey: ArrayBuffer;
  let testKey: CryptoKeyPair;

  beforeEach(async () => {
    senderEncryptionService = new EncryptionService();
    receiverEncryptionService = new EncryptionService();
    await Promise.all([senderEncryptionService.init(), receiverEncryptionService.init()]);

    testKey = await new DhkemP384HkdfSha384().generateKeyPair();
    receiverPublicKey = await receiverEncryptionService.getPublicKey();
  });

  it('should be defined', () => {
    expect(senderEncryptionService).toBeDefined();
  });

  it('should successfully encrypt and decrypt data -- unidirectional communication', async () => {
    // Test data to encrypt
    const testData = {
      message: 'Hello, encryption!',
      timestamp: Date.now(),
      metadata: {
        type: 'test',
        version: '1.0',
      },
    };

    // Encrypt the data using receiver's public key
    const {
      ciphertext,
      encapsulatedKey,
      publicKey: senderPublicKey,
    } = await senderEncryptionService.encrypt(testData);
    expect(ciphertext).toBeDefined();
    expect(encapsulatedKey).toBeDefined();
    expect(senderPublicKey).toBeDefined();

    /* Send {ciphertext, encapsulatedKey} over the wire */
    const decryptedData = await receiverEncryptionService.decrypt(ciphertext, encapsulatedKey);
    expect(decryptedData).toEqual(testData);
  });

  it('should successfully encrypt and decrypt data -- bidirectional communication', async () => {
    const testData = {
      message: 'Hello, encryption!',
      timestamp: Date.now(),
      metadata: {
        type: 'test',
        version: '1.0',
      },
    };

    // Encrypt the data using receiver's public key
    const {
      ciphertext,
      encapsulatedKey,
      publicKey: senderPublicKey,
    } = await senderEncryptionService.encrypt(testData, receiverPublicKey);
    expect(ciphertext).toBeDefined();
    expect(encapsulatedKey).toBeDefined();
    expect(senderPublicKey).toBeDefined();

    /* Send {ciphertext, encapsulatedKey} over the wire */
    const decryptedData = await receiverEncryptionService.decrypt(ciphertext, encapsulatedKey);
    expect(decryptedData).toEqual(testData);

    // Response scenario
    const responseData = {
      message: 'Hello, from the other side!',
      timestamp: Date.now(),
    };

    const { ciphertext: responseCiphertext, encapsulatedKey: responseEncapsulatedKey } =
      await receiverEncryptionService.encrypt(responseData, senderPublicKey);
    expect(responseCiphertext).toBeDefined();

    const decryptedResponseData = await senderEncryptionService.decrypt(
      responseCiphertext,
      responseEncapsulatedKey
    );
    expect(decryptedResponseData).toEqual(responseData);
  });
});
