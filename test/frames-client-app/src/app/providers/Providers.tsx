'use client';

import { CrossmintProvider, CrossmintAuthProvider } from '@crossmint/client-sdk-react-ui';
import CrossmintSignerProvider from './CrossmintSignerProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CrossmintProvider
      apiKey={process.env.NEXT_PUBLIC_CROSSMINT_API_KEY ?? ''}
      overrideBaseUrl={process.env.NEXT_PUBLIC_CROSSMINT_BASE_URL ?? ''}
    >
      <CrossmintAuthProvider loginMethods={['email']}>
        <CrossmintSignerProvider
          iframeUrl={
            new URL(
              process.env.NEXT_PUBLIC_CROSSMINT_SIGNER_URL ??
                'https://crossmint-signer-frames.onrender.com/'
            )
          }
        >
          {children}
        </CrossmintSignerProvider>
      </CrossmintAuthProvider>
    </CrossmintProvider>
  );
}
