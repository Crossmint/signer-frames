import {
  CipherSuite,
  Aes256Gcm,
  DhkemP256HkdfSha256,
  HkdfSha256,
  type SenderContext,
} from '@hpke/core';
import {
  bufferOrStringToBuffer,
  bufferToBase64,
  base64ToBuffer,
  serialize,
  deserialize,
} from './util';
import type { EncryptionResult } from '../encryption-consts';

export const suite = new CipherSuite({
  kem: new DhkemP256HkdfSha256(),
  kdf: new HkdfSha256(),
  aead: new Aes256Gcm(),
});

export async function encrypt<T extends Record<string, unknown>>(
  data: T,
  senderContext: SenderContext,
  senderPublicKey: CryptoKey
): Promise<EncryptionResult<ArrayBuffer>> {
  try {
    const serializedPublicKey = await suite.kem.serializePublicKey(senderPublicKey);
    const ciphertext = await senderContext.seal(
      serialize({
        data,
        encryptionContext: {
          senderPublicKey: bufferToBase64(serializedPublicKey),
        },
      })
    );

    return {
      ciphertext,
      publicKey: serializedPublicKey,
      encapsulatedKey: senderContext.enc,
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error}`);
  }
}

export async function decrypt<T extends Record<string, unknown>, U extends string | ArrayBuffer>(
  ciphertextInput: U,
  encapsulatedKeyInput: U,
  recipientPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey
): Promise<T> {
  try {
    const recipient = await suite.createRecipientContext({
      recipientKey: recipientPrivateKey,
      enc: bufferOrStringToBuffer(encapsulatedKeyInput),
      senderPublicKey,
    });

    const plaintext = await recipient.open(bufferOrStringToBuffer(ciphertextInput));
    return deserialize<{ data: T }>(plaintext).data;
  } catch (error) {
    throw new Error(`Decryption failed: ${error}`);
  }
}
