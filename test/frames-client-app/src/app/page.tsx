'use client';

import React, { Suspense } from 'react';
import AuthContent from './components/AuthContent';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading application...</p>
          </div>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
