export interface KeyPairProvider {
  getKeyPair(): Promise<CryptoKeyPair>;
}

export interface PublicKeyProvider {
  getPublicKey(): Promise<CryptoKey>;
}
