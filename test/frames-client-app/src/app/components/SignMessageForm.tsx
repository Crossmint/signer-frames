'use client';

import React, { useState } from 'react';
import { useCrossmintSigner } from '../providers/CrossmintSignerProvider';
import bs58 from 'bs58';

export default function SignMessageForm() {
  const { solanaSigner } = useCrossmintSigner();
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleReset = () => {
    setMessage('');
    setSignature(null);
    setError(null);
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

      {!signature ? (
        <button
          type="button"
          onClick={handleSignMessage}
          disabled={loading || !message.trim()}
          className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
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
      ) : (
        <>
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Signature</h3>
            <div className="p-3 bg-gray-50 rounded-md overflow-x-auto">
              <code className="text-xs text-gray-800 font-mono break-all">{signature}</code>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="w-full py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Sign Another Message
          </button>
        </>
      )}
    </div>
  );
}
