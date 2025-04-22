'use client';

import React, { useState } from 'react';
import Home from './Home';
import LoginPage from './LoginPage';
import { useAuth } from '@crossmint/client-sdk-react-ui';

// Define an interface for auth data with a specific user type
interface AuthUser {
  id: string;
  email?: string;
  phoneNumber?: string;
  [key: string]: unknown;
}

interface AuthData {
  user: AuthUser | null;
  login: () => void;
  logout: () => void;
  jwt?: string;
}

export default function AuthContent() {
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  // If we have an error, show it
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-red-50">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h2>
          <p className="text-gray-700 mb-6">{error.message}</p>
          <p className="text-sm text-gray-500">
            Please try refreshing the page or check your connection.
          </p>
        </div>
      </div>
    );
  }

  return user ? <Home /> : <LoginPage />;
}
