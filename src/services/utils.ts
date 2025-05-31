import bs58 from 'bs58';

export async function measureFunctionTime<T>(fnName: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  console.log(`Function ${fnName} took ${Math.round(end - start)}ms to execute`);
  return result;
}

export function decodeBytes(bytes: string, encoding: 'base64' | 'base58' | 'hex'): Uint8Array {
  switch (encoding) {
    case 'base58':
      return bs58.decode(bytes);
    case 'hex':
      return new Uint8Array(bytes.match(/.{1,2}/g)?.map(byte => Number.parseInt(byte, 16)) || []);
    case 'base64':
      return Uint8Array.from(atob(bytes), c => c.charCodeAt(0));
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

export function encodeBytes(bytes: Uint8Array, encoding: 'base64' | 'base58' | 'hex'): string {
  switch (encoding) {
    case 'base58':
      return bs58.encode(bytes);
    case 'hex':
      return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    case 'base64':
      return btoa(String.fromCharCode.apply(null, Array.from(bytes)));
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}
