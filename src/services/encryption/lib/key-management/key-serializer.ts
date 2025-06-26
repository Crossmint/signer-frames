import { DhkemP256HkdfSha256 } from "@hpke/core";
import { encodeBytes } from "../utils";

export class PublicKeySerializer {
  constructor(private readonly kem = new DhkemP256HkdfSha256()) {}

  async serializePublicKey(key: CryptoKey): Promise<string> {
    return encodeBytes(
      new Uint8Array(await this.kem.serializePublicKey(key)),
      "base64"
    );
  }

  async deserializePublicKey(serializedKey: string): Promise<CryptoKey> {
    return await this.kem.deserializePublicKey(
      Uint8Array.from(atob(serializedKey), (c) => c.charCodeAt(0)).buffer
    );
  }

  async serializePrivateKey(key: CryptoKey): Promise<string> {
    return encodeBytes(
      new Uint8Array(await this.kem.serializePrivateKey(key)),
      "base64"
    );
  }

  async deserializePrivateKey(serializedKey: string): Promise<CryptoKey> {
    return await this.kem.deserializePrivateKey(
      Uint8Array.from(atob(serializedKey), (c) => c.charCodeAt(0)).buffer
    );
  }
}
