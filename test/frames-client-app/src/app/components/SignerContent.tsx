'use client';

import { useState, useEffect } from 'react';
import { useCrossmintSigner } from '../providers/CrossmintSignerProvider';

// Simple spinner component
const Spinner = () => (
  <svg
    className="animate-spin h-5 w-5 text-indigo-600"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="img"
    aria-label="Loading spinner"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export default function SignerContent() {
  const [isLoading, setIsLoading] = useState(false);
  const { solanaSigner } = useCrossmintSigner();

  useEffect(() => {
    // Show loading state for a short time when component mounts
    if (!solanaSigner) {
      setIsLoading(true);
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
    return () => {};
  }, [solanaSigner]);

  return (
    <div className="w-full mx-auto max-w-md">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Solana Signer</h2>
          {solanaSigner?.address && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Active
            </span>
          )}
        </div>

        <div className="p-5">
          <div className="text-sm text-gray-500 mb-2 flex items-center justify-between">
            <span>Solana Address</span>
            {isLoading && <Spinner />}
          </div>
          {solanaSigner?.address ? (
            <div className="font-mono bg-gray-100 p-3 rounded-lg text-gray-800 break-all">
              {solanaSigner.address}
            </div>
          ) : (
            <div className="font-mono bg-gray-100 p-3 rounded-lg text-gray-400 italic flex items-center justify-center">
              {isLoading ? 'Initializing signer...' : 'No signer available'}
            </div>
          )}
        </div>

        {solanaSigner?.address && (
          <div className="p-5 border-t border-gray-100 flex justify-center">
            <span className="inline-flex items-center text-sm text-green-600">
              <svg
                className="w-4 h-4 mr-1"
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
              Signer ready to use
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
