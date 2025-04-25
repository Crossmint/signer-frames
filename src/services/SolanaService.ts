import bs58 from 'bs58';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import * as nacl from 'tweetnacl';

export class SolanaService {
  public getKeypair(masterSecret: Uint8Array): Keypair {
    return Keypair.fromSeed(masterSecret);
  }

  async signMessage(messageBase58: string, keypair: Keypair): Promise<string> {
    const messageBytes = bs58.decode(messageBase58);
    const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
    return bs58.encode(signatureBytes);
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
