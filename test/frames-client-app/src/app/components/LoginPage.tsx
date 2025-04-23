'use client';

import React from 'react';
import { useAuth } from '@crossmint/client-sdk-react-ui';

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
        <h1 className="text-2xl font-bold mb-6">Frames Testing App</h1>
        <p className="text-gray-600 mb-8">
          Please login to start creating signers and signing messages.
        </p>
        <button
          type="button"
          onClick={login}
          className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Login with Crossmint
        </button>
      </div>
    </main>
  );
}
