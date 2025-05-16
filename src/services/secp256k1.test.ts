import { describe, it, expect, vi } from 'vitest';
import { type Hex, type PrivKey, Secp256k1Service } from './secp256k1';
import { concat, ethers, keccak256, toUtf8Bytes, Transaction, type TransactionLike } from 'ethers';

describe('Secp256k1Service', () => {
  let privKeyString: string;
  let privKey: PrivKey;
  let address: Hex;
  let service: Secp256k1Service;
  const MessagePrefix = '\x19Ethereum Signed Message:\n';
  beforeEach(() => {
    vi.clearAllMocks();
    privKeyString = '00ba4b67fbb7efd511188eba491c39aa49e9362df4fdce6eda8765801ad54cbf';
    privKey = Buffer.from(privKeyString, 'hex');
    address = '0x8dBcdFE43b9a6326e71378DfCA5e10e25F2C11A4';
    service = new Secp256k1Service();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get correctAddress', async () => {
    const publicKey = await service.getPublicKey(privKey);
    const derivedAddress = await service.getAddress(publicKey);
    expect(derivedAddress).toBe(address);
  });

  it('should sign a message correctly -- should match ethers signature', async () => {
    const message = 'Hello world';

    const ethersWallet = new ethers.Wallet(privKeyString);
    const ethersSignature = await ethersWallet.signMessage(message);

    const mySignMessage = async (message: string) => {
      const messageBytes = toUtf8Bytes(message);
      const digest = keccak256(
        concat([toUtf8Bytes(MessagePrefix), toUtf8Bytes(String(messageBytes.length)), messageBytes])
      );
      return service.sign(digest as Hex, privKey);
    };
    const messageSignature = await mySignMessage(message);

    expect(ethersSignature).toBe(messageSignature);
  });

  it('should sign a transaction correctly -- should match ethers signature', async () => {
    const tx = {
      to: address,
      value: ethers.parseEther('1'),
      data: '0x',
      nonce: 0,
      gasLimit: 2000000,
      gasPrice: ethers.parseUnits('100', 'gwei'),
      chainId: 1,
    };

    const ethersWallet = new ethers.Wallet(privKeyString);
    const ethersSignedTx = await ethersWallet.signTransaction(tx);

    const mySignTransaction = async (tx: TransactionLike<string>) => {
      const transaction = Transaction.from(tx);
      const signature = await service.sign(transaction.unsignedHash as Hex, privKey);
      transaction.signature = signature;
      return transaction.serialized;
    };
    const signedTx = await mySignTransaction(tx);

    expect(ethersSignedTx).toBe(signedTx);
  });

  it('should generate a private key from a seed', async () => {
    const address = '0x41aD2bc63A2059f9b623533d87fe99887D794847';
    const privateKey = await service.privateKeyFromSeed(new Uint8Array(0));
    expect(privateKey).toBeDefined();
    expect(await service.getAddress(await service.getPublicKey(privateKey))).toBe(address);
  });
});
