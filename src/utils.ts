/**
 * Common KeyManager - Contains shared cryptographic utilities
 */

// Base58 alphabet
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = BigInt(ALPHABET.length);

/**
 * Convert a Uint8Array to a hex string
 * @param {Uint8Array} uint8array - The array to convert
 * @returns {string} The hex string representation
 */
export function uint8ArrayToHex(uint8array: Uint8Array): string {
  if (!uint8array || uint8array.length === 0) return '';

  return Array.from(uint8array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a hex string to a Uint8Array
 * @param {`0x${string}`} hex - The hex string to convert
 * @returns {Uint8Array} The Uint8Array representation
 */
export function hexToUint8Array(hex: string): Uint8Array {
  if (typeof hex !== 'string') {
    throw new Error('Expected string containing hex data');
  }

  if (hex === '') return new Uint8Array(0);

  // Remove '0x' prefix if present
  const hexString = hex.startsWith('0x') ? hex.slice(2) : hex;

  // Ensure even length
  const normalizedHex = hexString.length % 2 ? `0${hexString}` : hexString;

  const bytes = new Uint8Array(normalizedHex.length / 2);

  for (let i = 0; i < normalizedHex.length; i += 2) {
    const byteValue = Number.parseInt(normalizedHex.substr(i, 2), 16);
    bytes[i / 2] = byteValue;
  }

  return bytes;
}

/**
 * Encode a Uint8Array to Base58 string
 * @param {Uint8Array} data - Data to encode
 * @returns {string} Base58 encoded string
 */
export function base58Encode(data: Uint8Array): string {
  if (!data || data.length === 0) return '';

  // Count leading zeros
  let leadingZeros = 0;
  for (let i = 0; i < data.length && data[i] === 0; i++) {
    leadingZeros++;
  }

  // Convert data to BigInt
  let num = 0n;
  for (let i = 0; i < data.length; i++) {
    num = num * 256n + BigInt(data[i]);
  }

  // Special case for zero values
  if (num === 0n) {
    return '1'.repeat(leadingZeros);
  }

  // Convert to Base58
  let result = '';
  while (num > 0n) {
    const mod = Number(num % BASE);
    num = num / BASE;
    result = `${ALPHABET[mod]}${result}`;
  }

  // Add leading '1's (equivalent to zero in Base58)
  return '1'.repeat(leadingZeros) + result;
}

/**
 * Decode a Base58 string to Uint8Array
 * @param {string} str - Base58 encoded string
 * @returns {Uint8Array} Decoded data
 */
export function base58Decode(str: string): Uint8Array {
  if (!str || str.length === 0) return new Uint8Array(0);

  // Count leading '1's
  let leadingZeros = 0;
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    leadingZeros++;
  }

  // Special case: all '1's
  if (leadingZeros === str.length) {
    return new Uint8Array(leadingZeros);
  }

  // Convert from Base58
  let num = 0n;
  for (let i = leadingZeros; i < str.length; i++) {
    const char = str[i];
    const charIndex = ALPHABET.indexOf(char);
    if (charIndex === -1) {
      throw new Error(`Invalid character '${char}' at index ${i}`);
    }
    num = num * BASE + BigInt(charIndex);
  }

  // Convert to byte array
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num = num / 256n;
  }

  // Add leading zeros
  const result = new Uint8Array(leadingZeros + bytes.length);
  bytes.forEach((b, i) => {
    result[leadingZeros + i] = b;
  });

  return result;
}

/**
 * Decode a Base64 string to Uint8Array
 * @param {string} str - Base64 encoded string
 * @returns {Uint8Array} Decoded data
 */
export function base64Decode(str: string): Uint8Array {
  // For browsers
  if (typeof window !== 'undefined') {
    const binary = window.atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return Uint8Array.from(Buffer.from(str, 'base64'));
}
