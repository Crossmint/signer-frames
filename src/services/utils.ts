/**
 * Base58 encoding and decoding utilities
 */
export class Base58Utils {
  private readonly ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  private readonly BASE = BigInt(this.ALPHABET.length);

  /**
   * Encode a Uint8Array to Base58 string
   * @param {Uint8Array} data - Data to encode
   * @returns {string} Base58 encoded string
   */
  base58Encode(data: Uint8Array): string {
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
      const mod = Number(num % this.BASE);
      num = num / this.BASE;
      result = `${this.ALPHABET[mod]}${result}`;
    }

    // Add leading '1's (equivalent to zero in Base58)
    return '1'.repeat(leadingZeros) + result;
  }

  /**
   * Decode a Base58 string to Uint8Array
   * @param {string} str - Base58 encoded string
   * @returns {Uint8Array} Decoded data
   */
  base58Decode(str: string): Uint8Array {
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
      const charIndex = this.ALPHABET.indexOf(char);
      if (charIndex === -1) {
        throw new Error(`Invalid character '${char}' at index ${i}`);
      }
      num = num * this.BASE + BigInt(charIndex);
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
}
