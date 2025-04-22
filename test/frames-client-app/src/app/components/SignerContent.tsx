'use client';

import { useState } from 'react';
import { useCrossmintSigner } from '../providers/CrossmintSignerProvider';

// Define interface for signer result
interface SignerResult {
  solanaSigner: { address?: string } | null;
  initSigner: (chain: string) => Promise<void>;
}

export default function SignerContent() {
  const [isLoading, setIsLoading] = useState(false);

  const { solanaSigner, initSigner } = useCrossmintSigner();

  const handleCreateSigner = async () => {
    setIsLoading(true);
    try {
      await initSigner('solana');
    } catch (error) {
      console.error('Failed to initialize signer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1 rounded-2xl shadow-lg">
        <div className="bg-white p-8 rounded-xl">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Solana Signer</h2>

          <div className="text-center mb-6">
            <div className="text-sm text-gray-500 mb-2">Solana Address</div>
            {solanaSigner?.address ? (
              <div className="font-mono bg-gray-100 p-3 rounded-lg text-gray-800 break-all">
                {solanaSigner.address}
              </div>
            ) : (
              <div className="font-mono bg-gray-100 p-3 rounded-lg text-gray-400 italic">
                No signer created yet
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center mt-8">
            <button
              type="button"
              onClick={handleCreateSigner}
              disabled={isLoading}
              className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500
                ${
                  solanaSigner?.address
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-purple-600 hover:bg-purple-700'
                }
                ${isLoading ? 'opacity-70 cursor-not-allowed' : 'transform hover:scale-105'}
              `}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating Signer...
                </span>
              ) : solanaSigner?.address ? (
                'Refresh Signer'
              ) : (
                'Create Solana Signer'
              )}
            </button>

            {solanaSigner?.address && (
              <div className="mt-4 text-sm text-gray-500">
                <span className="inline-flex items-center">
                  <svg
                    className="w-4 h-4 mr-1 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Signer successfully created
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
