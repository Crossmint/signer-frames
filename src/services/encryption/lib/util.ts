import { encodeBytes, decodeBytes } from '../../common/utils';

export function serialize<T extends Record<string, unknown>>(data: T): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data));
}

export function deserialize<T extends Record<string, unknown>>(data: ArrayBuffer): T {
  return JSON.parse(new TextDecoder().decode(data)) as T;
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  return encodeBytes(new Uint8Array(buffer), 'base64');
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  return decodeBytes(base64, 'base64').buffer;
}

export function bufferOrStringToBuffer(value: string | ArrayBuffer): ArrayBuffer {
  return typeof value === 'string' ? base64ToBuffer(value) : value;
}
