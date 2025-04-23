'use client';

import React from 'react';
import { useAuth } from '@crossmint/client-sdk-react-ui';
import SignerContent from './SignerContent';
import AuthButton from './AuthButton';
import { useCrossmintSigner } from '../providers/CrossmintSignerProvider';

export default function Home() {
  const { logout } = useAuth();
  const { initSigner, solanaSigner } = useCrossmintSigner();

  const handleCreateNewSigner = () => {
    initSigner('solana');
  };

  return (
    <main className="min-h-screen flex flex-col p-6 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-4xl mx-auto w-full">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-3xl font-bold text-gray-800">Crossmint Frames Testing App</h1>
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Logout
          </button>
        </header>

        <div className="flex flex-col gap-10">
          <div className="flex flex-col">
            <SignerContent />
            {solanaSigner && (
              <button
                type="button"
                onClick={handleCreateNewSigner}
                className="mx-auto mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create New Signer
              </button>
            )}
          </div>
          <AuthButton />
        </div>

        <footer className="mt-16 text-center text-sm text-gray-500">
          <p>Built with Next.js and Crossmint &copy; {new Date().getFullYear()}</p>
        </footer>
      </div>
    </main>
  );
}
