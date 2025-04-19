/**
 * Solana KeyManager - Handles Solana-specific cryptographic key operations
 */
import { 
    getPublicKey as ed25519GetPublicKey, 
    sign as ed25519Sign, 
    verify as ed25519Verify 
} from './lib/noble-ed25519.js';

import { 
    uint8ArrayToHex, 
    hexToUint8Array, 
    base58Encode, 
    base58Decode 
} from './common.js';

/**
 * Generate a random Solana private key
 * @returns {Promise<string>} Base58-encoded private key
 */
export async function generatePrivateKey() {
    const privateKeyBytes = new Uint8Array(32);
    crypto.getRandomValues(privateKeyBytes);
    return base58Encode(privateKeyBytes);
}

/**
 * Derive a Solana public key from a private key
 * @param {string} privateKeyBase58 - Base58-encoded private key
 * @returns {Promise<string>} Base58-encoded public key
 */
export async function getPublicKey(privateKeyBase58) {
    try {
        const privateKeyBytes = base58Decode(privateKeyBase58);
        const publicKeyBytes = await ed25519GetPublicKey(privateKeyBytes);
        return base58Encode(publicKeyBytes);
    } catch (error) {
        console.error('Error deriving Solana public key:', error);
        throw error;
    }
}

/**
 * Sign a message with a Solana private key using ed25519
 * @param {Uint8Array|string} message - Message to sign (Uint8Array or utf-8 string)
 * @param {string} privateKeyBase58 - Base58-encoded private key
 * @returns {Promise<string>} Base58-encoded signature
 */
export async function signMessage(message, privateKeyBase58) {
    try {
        // Convert string message to Uint8Array if needed
        const messageBytes = typeof message === 'string' 
            ? new TextEncoder().encode(message) 
            : message;
        
        const privateKeyBytes = base58Decode(privateKeyBase58);
        const signatureBytes = await ed25519Sign(messageBytes, privateKeyBytes);
        return base58Encode(signatureBytes);
    } catch (error) {
        console.error('Error signing with Solana key:', error);
        throw error;
    }
}

/**
 * Verify a signature with a Solana public key
 * @param {Uint8Array|string} message - Message that was signed (Uint8Array or utf-8 string)
 * @param {string} signatureBase58 - Base58-encoded signature
 * @param {string} publicKeyBase58 - Base58-encoded public key
 * @returns {Promise<boolean>} Whether the signature is valid
 */
export async function verifySignature(message, signatureBase58, publicKeyBase58) {
    try {
        // Convert string message to Uint8Array if needed
        const messageBytes = typeof message === 'string' 
            ? new TextEncoder().encode(message) 
            : message;
        
        const signatureBytes = base58Decode(signatureBase58);
        const publicKeyBytes = base58Decode(publicKeyBase58);
        
        return await ed25519Verify(signatureBytes, messageBytes, publicKeyBytes);
    } catch (error) {
        console.error('Error verifying Solana signature:', error);
        return false;
    }
} 