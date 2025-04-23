'use client';

import React from 'react';
import { useAuth } from '@crossmint/client-sdk-react-ui';
import LoginPage from './LoginPage';
import SignerPage from './SignerPage';

export default function AuthContent() {
  const { user } = useAuth();

  // If user is authenticated, show signer page, otherwise show login page
  return user ? <SignerPage /> : <LoginPage />;
}
