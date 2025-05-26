import { XMIFService } from './service';
import { secp256k1 } from 'ethereum-cryptography/secp256k1.js';
import { keccak256 } from 'ethereum-cryptography/keccak.js';
import { sha256 } from 'ethereum-cryptography/sha256.js';
import { toHex } from 'ethereum-cryptography/utils';
const SECP256K1_DERIVATION_PATH = new Uint8Array([
  0x73, 0x65, 0x63, 0x70, 0x32, 0x35, 0x36, 0x6b, 0x31, 0x2d, 0x64, 0x65, 0x72, 0x69, 0x76, 0x61,
  0x74, 0x69, 0x6f, 0x6e, 0x2d, 0x70, 0x61, 0x74, 0x68,
]);

export type Hex = `0x${string}`;
export type PrivKey = Uint8Array;
export class Secp256k1Service extends XMIFService {
  name = 'secp256k1';
  log_prefix = 'secp256k1';

  async privateKeyFromSeed(seed: Uint8Array): Promise<PrivKey> {
    const secp256k1DerivationSeed = new Uint8Array(seed.length + SECP256K1_DERIVATION_PATH.length);
    secp256k1DerivationSeed.set(seed, 0);
    secp256k1DerivationSeed.set(SECP256K1_DERIVATION_PATH, seed.length);
    const privateKey = sha256(secp256k1DerivationSeed);

    // An Ethereum private key must be an integer > 0 and < N (the order of the secp256k1 curve ~2^256-2^32-977).
    // The probability of a SHA256 hash being 0 or >= N is astronomically small.
    // Here, we handle that case
    if (!secp256k1.utils.isValidPrivateKey(privateKey)) {
      return this.privateKeyFromSeed(privateKey);
    }

    return privateKey;
  }

  async getPublicKey(privateKey: PrivKey): Promise<Uint8Array> {
    return secp256k1.getPublicKey(privateKey, false);
  }

  // https://ethereum.org/en/developers/docs/accounts/#account-creation
  async getAddress(publicKey: Uint8Array): Promise<Hex> {
    const hash = keccak256(publicKey.slice(1)).slice(-20);
    const address = `0x${toHex(hash)}`;
    return this.toChecksumAddress(address as Hex);
  }

  async sign(digest: Hex | Uint8Array, privateKey: PrivKey): Promise<Hex> {
    const digestBytes = typeof digest === 'string' ? this.hexDecode(digest) : digest;
    if (digestBytes.length !== 32) {
      throw new Error('Digest must be 32 bytes');
    }
    const sig = secp256k1.sign(digestBytes, privateKey, { lowS: true });
    const toBigEndianHex = (value: bigint) => value.toString(16).padStart(32, '0');
    const r = toBigEndianHex(sig.r);
    const s = toBigEndianHex(sig.s);
    const v = sig.recovery ? '1c' : '1b';
    return `0x${r}${s}${v}` as Hex;
  }

  // https://eips.ethereum.org/EIPS/eip-55
  private toChecksumAddress(address: Hex): Hex {
    const hashInput = Buffer.from(address.toLowerCase().replace('0x', ''), 'ascii');
    const hash = [...keccak256(hashInput)].map(v => v.toString(16).padStart(2, '0')).join('');

    return `0x${address
      .slice(2)
      .split('')
      .map((char, i) => (Number.parseInt(hash[i], 16) >= 8 ? char.toUpperCase() : char))
      .join('')}` as Hex;
  }

  private hexDecode(hex: Hex): Uint8Array {
    return Buffer.from(hex.slice(2), 'hex');
  }
}
