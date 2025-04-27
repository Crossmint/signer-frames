import bs58 from 'bs58';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import type { Ed25519Service } from './ed25519';

// TODO: delete this file
export class SolanaService {
  private readonly ed25519Service: Ed25519Service;

  constructor(ed25519Service: Ed25519Service) {
    this.ed25519Service = ed25519Service;
  }

  public async getKeypair(masterSecret: Uint8Array): Promise<Keypair> {
    return Keypair.fromSecretKey(await this.ed25519Service.secretKeyFromSeed(masterSecret));
  }

  async signTransaction(
    transactionBase58: string,
    keypair: Keypair
  ): Promise<{ transaction: string; signature: string }> {
    const transaction = VersionedTransaction.deserialize(bs58.decode(transactionBase58));
    const signerIndex = transaction.message.staticAccountKeys.findIndex(key =>
      key.equals(keypair.publicKey)
    );
    transaction.sign([keypair]);
    return {
      transaction: bs58.encode(transaction.serialize()),
      signature: bs58.encode(transaction.signatures[signerIndex]),
    };
  }
}
