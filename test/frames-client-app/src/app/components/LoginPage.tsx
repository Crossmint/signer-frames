'use client';

import React from 'react';
import AuthButton from './AuthButton';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-4xl w-full flex flex-col items-center">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Crossmint Frames Testing App</h1>
        </div>

        <div className="flex justify-center mb-8">
          <AuthButton />
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            Powered by{' '}
            <a
              href="https://www.crossmint.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 underline"
            >
              Crossmint
            </a>{' '}
            — The easiest way to onboard users to web3
          </p>
        </div>
      </div>
    </main>
  );
}
