import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  secureSignerInboundEvents,
  secureSignerOutboundEvents,
  type SecureSignerInboundEvents,
  type SecureSignerOutboundEvents,
} from '@crossmint/client-signers';
import { IFrameWindow } from '@crossmint/client-sdk-window';
import { useAuth, useCrossmint } from '@crossmint/client-sdk-react-ui';
import bs58 from 'bs58';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import OTPDialog from '../components/OTPDialog';

// POTATO - Add debug logging
console.log('POTATO - CrossmintSignerProvider module loaded');

const defaultEventOptions = {
  timeoutMs: 10000,
  intervalMs: 5000,
};

// Simple initializing component to show while connecting to the iframe
const InitializingComponent = () => (
  <div className="flex flex-col items-center justify-center p-4">
    <div className="w-10 h-10 border-4 border-t-transparent border-current rounded-full animate-spin mb-4" />
    <p className="text-cm-text-secondary text-center">Initializing secure connection...</p>
  </div>
);

// Type definitions
export interface CreateSignerProps {
  iframeUrl: URL;
  apiKey: string;
  chainLayer: 'solana';
}

export interface CrossmintSolanaSigner {
  address: string;
  publicKey: PublicKey;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
}

export interface CrossmintSignerContext {
  error: Error | null;
  initSigner: (chainLayer: 'solana') => void;
  solanaSigner: CrossmintSolanaSigner | null;
}

const CrossmintSignerContext = createContext<CrossmintSignerContext | null>(null);

export function useCrossmintSigner() {
  const context = useContext(CrossmintSignerContext);
  console.log('POTATO - useCrossmintSigner called, context:', context ? 'exists' : 'null');
  if (context == null) {
    throw new Error('useCrossmintSigner must be used within a CrossmintSignerProvider');
  }
  return context;
}

export type CrossmintSignerProviderProps = {
  children: ReactNode;
  iframeUrl?: URL;
  apiKey?: string;
};

export default function CrossmintSignerProvider({
  children,
  iframeUrl = new URL(process.env?.NEXT_PUBLIC_SECURE_ENDPOINT_URL ?? 'secure.crossmint.com'),
}: CrossmintSignerProviderProps) {
  console.log('POTATO - CrossmintSignerProvider rendering');
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [isInitializingSigner, setIsInitializingSigner] = useState(false);
  const [solanaSigner, setSolanaSigner] = useState<CrossmintSolanaSigner | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const {
    crossmint: { apiKey },
  } = useCrossmint();
  const { jwt, user } = useAuth();
  const iframe = useRef<HTMLIFrameElement>(null);
  const iframeWindow = useRef<IFrameWindow<
    SecureSignerOutboundEvents,
    SecureSignerInboundEvents
  > | null>(null);

  console.log('POTATO - Before useAuth');
  console.log('POTATO - useAuth succeeded:', jwt ? 'exists' : 'null', 'jwt available:', !!jwt);

  useEffect(() => {
    console.log('POTATO - useEffect for OTP dialog triggered');
    if (solanaSigner != null && otpDialogOpen) {
      setOtpDialogOpen(false);
    }
  }, [solanaSigner, otpDialogOpen]);

  const initIFrameWindow = useCallback(async () => {
    console.log('POTATO - initIFrameWindow called');
    if (iframe.current == null) {
      try {
        setIsInitializing(true);
        console.log('POTATO - Initializing iframe window with URL:', iframeUrl.toString());
        iframeWindow.current = await IFrameWindow.init(iframeUrl.toString(), {
          targetOrigin: iframeUrl.origin,
          incomingEvents: secureSignerOutboundEvents,
          outgoingEvents: secureSignerInboundEvents,
        });

        console.log('POTATO - Trying to handshake with iframe...');
        await iframeWindow.current.handshakeWithChild();
        console.log('POTATO - Parent connected to iframe!');
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error('POTATO - Failed to initialize or connect to iframe:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsInitializing(false);
      }
    }
  }, [iframeUrl.origin, iframeUrl]);

  const buildSolanaSigner = (address: string) => {
    console.log('POTATO - buildSolanaSigner called with address:', address);
    return {
      address,
      publicKey: new PublicKey(address),
      signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
        try {
          console.log('POTATO - signMessage called');
          assertInitialized();
          const response = await iframeWindow.current?.sendAction({
            event: 'request:sign-message',
            responseEvent: 'response:sign-message',
            data: {
              version: 1,
              message: bs58.encode(message),
              jwt: jwt as NonNullable<typeof jwt>,
              apiKey,
              chainLayer: 'solana',
              encoding: 'base58',
            },
            options: defaultEventOptions,
          });
          if (response?.signature == null) {
            throw new Error('Failed to sign message');
          }
          const signature = bs58.decode(response?.signature);
          return signature;
        } catch (error) {
          console.error('POTATO - Failed to sign message:', error);
          throw error;
        }
      },
      signTransaction: async (transaction: VersionedTransaction): Promise<VersionedTransaction> => {
        try {
          console.log('POTATO - signTransaction called');
          assertInitialized();
          const response = await iframeWindow.current?.sendAction({
            event: 'request:sign-transaction',
            responseEvent: 'response:sign-transaction',
            data: {
              version: 1,
              transaction: bs58.encode(transaction.serialize()),
              jwt: jwt as NonNullable<typeof jwt>,
              apiKey,
              chainLayer: 'solana',
              encoding: 'base58',
            },
            options: defaultEventOptions,
          });
          if (response?.transaction == null) {
            throw new Error('Failed to sign transaction');
          }
          return VersionedTransaction.deserialize(bs58.decode(response?.transaction));
        } catch (error) {
          console.error('POTATO - Failed to sign transaction:', error);
          throw error;
        }
      },
    };
  };

  const assertInitialized = () => {
    console.log('POTATO - assertInitialized called');
    if (iframeWindow.current == null) {
      throw new Error('Iframe window not initialized');
    }
    if (jwt == null) {
      throw new Error('JWT not initialized');
    }
    if (user == null) {
      throw new Error('User not initialized');
    }
  };

  const initSigner = useCallback(() => {
    console.log('POTATO - initSigner called - state:', {
      isInitializingSigner,
      hasSolanaSigner: !!solanaSigner,
      hasJwt: !!jwt,
      hasApiKey: !!apiKey,
    });
    try {
      if (isInitializingSigner || solanaSigner || !jwt || !apiKey) {
        console.log('POTATO - initSigner early return');
        return;
      }
      setIsInitializingSigner(true);
      // Initialize the iframe window if not already done
      if (!isInitialized && !isInitializing) {
        console.log('POTATO - initIFrameWindow will be called');
        initIFrameWindow().then(() => {
          setOtpDialogOpen(true);
        });
      } else {
        console.log('POTATO - OTP dialog will be opened directly');
        setOtpDialogOpen(true);
      }
    } catch (error) {
      console.error('POTATO - Error creating signer:', error);
      throw error;
    }
  }, [
    isInitialized,
    isInitializing,
    isInitializingSigner,
    solanaSigner,
    jwt,
    apiKey,
    initIFrameWindow,
  ]);

  // Handle OTP dialog event handlers
  const handleCreateSignerEvent = async () => {
    console.log('POTATO - handleCreateSignerEvent called');
    assertInitialized();
    if (iframeWindow.current == null || jwt == null || apiKey == null) {
      throw new Error('Failed to create signer. The component has not been initialized');
    }
    await iframeWindow.current?.sendAction({
      event: 'request:create-signer',
      responseEvent: 'response:create-signer',
      data: {
        version: 1,
        jwt,
        apiKey,
        authId: `email:${user?.email}`,
      },
    });
  };

  const handleEncryptedOtpEvent = async (encryptedOtp: string, chainLayer: 'solana') => {
    console.log('POTATO - handleEncryptedOtpEvent called');
    assertInitialized();
    if (iframeWindow.current == null || jwt == null || apiKey == null) {
      throw new Error('Failed to create signer. The component has not been initialized');
    }
    const response = await iframeWindow.current.sendAction({
      event: 'request:send-otp',
      responseEvent: 'response:send-otp',
      data: {
        version: 1,
        jwt,
        apiKey,
        encryptedOtp,
        chainLayer,
      },
    });
    if (response?.address == null) {
      throw new Error('Failed to validate encrypted OTP');
    }
    return response.address;
  };

  const handleAddressFetched = (address: string) => {
    console.log('POTATO - handleAddressFetched called with address:', address);
    setSolanaSigner(buildSolanaSigner(address));
    setOtpDialogOpen(false);
    setIsInitializingSigner(false);
  };

  return (
    <>
      <CrossmintSignerContext.Provider
        value={{
          error,
          initSigner,
          solanaSigner,
        }}
      >
        <>
          {isInitializing && <InitializingComponent />}
          {isInitialized && (
            <OTPDialog
              open={otpDialogOpen}
              sendCreateSignerEvent={handleCreateSignerEvent}
              sendEncryptedOtpEvent={handleEncryptedOtpEvent}
              onAddressFetched={handleAddressFetched}
            />
          )}
          {children}
        </>
      </CrossmintSignerContext.Provider>
    </>
  );
}
