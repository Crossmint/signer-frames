'use client';

import React, { useState } from 'react';
import { useCrossmintSigner } from '../providers/CrossmintSignerProvider';
import bs58 from 'bs58';
import { SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';

export default function SignMessageForm() {
  const { solanaSigner } = useCrossmintSigner();
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [preSignedTx, setPreSignedTx] = useState<string | null>(null);
  const [postSignedTx, setPostSignedTx] = useState<string | null>(null);

  const handleSignMessage = async () => {
    if (!message.trim() || !solanaSigner) {
      return;
    }

    setLoading(true);
    setError(null);
    setSignature(null);

    try {
      // Convert string to Uint8Array for signing
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message);

      // Sign the message
      const signedMessage = await solanaSigner.signMessage(messageBytes);

      // Convert the signature to a base64 string for display
      const signatureBase58 = bs58.encode(signedMessage);

      setSignature(signatureBase58);
    } catch (err) {
      console.error('Error signing message:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign message');
    } finally {
      setLoading(false);
    }
  };

  const handleSignTransaction = async () => {
    if (!solanaSigner) {
      console.log('No signer available in handleSignTransaction');
      return;
    }

    console.log('Starting transaction signing with signer:', solanaSigner);

    setTransactionLoading(true);
    setError(null);
    setTransactionSignature(null);
    setPreSignedTx(null);
    setPostSignedTx(null);

    try {
      const transaction = createDummyTransaction();
      console.log('Created dummy transaction');

      // Serialize and encode the unsigned transaction
      const unsignedTxSerialized = bs58.encode(transaction.serialize());
      console.log('Unsigned transaction serialized');
      setPreSignedTx(unsignedTxSerialized);

      console.log('About to sign transaction with signer:', solanaSigner);
      const signedTransaction = await solanaSigner.signTransaction(transaction);
      console.log('Transaction signed successfully');

      const signedTxSerialized = bs58.encode(signedTransaction.serialize());
      console.log('Signed transaction serialized');

      setPostSignedTx(signedTxSerialized);
      setTransactionSignature(signedTxSerialized);
    } catch (err) {
      console.error('Error signing transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign transaction');
    } finally {
      setTransactionLoading(false);
    }
  };

  const createDummyTransaction = (): VersionedTransaction => {
    if (!solanaSigner) {
      throw new Error('No signer available');
    }

    return new VersionedTransaction(
      new TransactionMessage({
        payerKey: SystemProgram.programId,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: solanaSigner.publicKey,
            toPubkey: solanaSigner.publicKey,
            lamports: 1000000000,
          }),
        ],
        recentBlockhash: '11111111111111111111111111111111',
      }).compileToV0Message()
    );
  };

  const handleReset = () => {
    setMessage('');
    setSignature(null);
    setTransactionSignature(null);
    setPreSignedTx(null);
    setPostSignedTx(null);
    setError(null);
  };

  const logSignerState = () => {
    console.log('Current Signer State:', {
      solanaSigner,
      deviceId: solanaSigner?.address || 'none',
      publicKey: solanaSigner?.publicKey?.toString() || 'none',
      signMessageFn: solanaSigner?.signMessage ? 'Available' : 'Not Available',
      signTransactionFn: solanaSigner?.signTransaction ? 'Available' : 'Not Available',
    });
  };

  if (!solanaSigner) {
    return <div>No signer available</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Sign a Message</h2>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

      <div className="mb-4">
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          Message
        </label>
        <textarea
          id="message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          disabled={loading}
          className="w-full p-2 border border-gray-300 rounded-md min-h-[100px]"
          placeholder="Enter a message to sign"
        />
      </div>

      <div className="flex flex-col space-y-4">
        {!signature && !transactionSignature ? (
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={handleSignMessage}
              disabled={loading || !message.trim() || transactionLoading}
              className="flex-1 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 mr-2 border-2 border-white border-t-transparent rounded-full" />
                  Signing...
                </>
              ) : (
                'Sign Message'
              )}
            </button>

            <button
              type="button"
              onClick={handleSignTransaction}
              disabled={loading || transactionLoading}
              className="flex-1 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {transactionLoading ? (
                <>
                  <div className="animate-spin h-5 w-5 mr-2 border-2 border-white border-t-transparent rounded-full" />
                  Signing Tx...
                </>
              ) : (
                'Sign Transaction'
              )}
            </button>
          </div>
        ) : (
          <>
            {signature && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Message Signature</h3>
                <div className="p-3 bg-gray-50 rounded-md overflow-x-auto">
                  <code className="text-xs text-gray-800 font-mono break-all">{signature}</code>
                </div>
              </div>
            )}

            {preSignedTx && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Pre-Signed Transaction</h3>
                <div className="p-3 bg-gray-50 rounded-md overflow-x-auto">
                  <code className="text-xs text-gray-800 font-mono break-all">{preSignedTx}</code>
                </div>
              </div>
            )}

            {postSignedTx && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Post-Signed Transaction</h3>
                <div className="p-3 bg-gray-50 rounded-md overflow-x-auto">
                  <code className="text-xs text-gray-800 font-mono break-all">{postSignedTx}</code>
                </div>
              </div>
            )}

            {transactionSignature && !postSignedTx && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Transaction Signature</h3>
                <div className="p-3 bg-gray-50 rounded-md overflow-x-auto">
                  <code className="text-xs text-gray-800 font-mono break-all">
                    {transactionSignature}
                  </code>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Start Over
            </button>
          </>
        )}

        {/* Debug button */}
        <button
          type="button"
          onClick={logSignerState}
          className="py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 mt-2"
        >
          Debug Signer
        </button>
      </div>
    </div>
  );
}
