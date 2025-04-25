import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { signerInboundEvents, signerOutboundEvents } from '@crossmint/client-signers';
import { IFrameWindow } from '@crossmint/client-sdk-window';
import { useAuth, useCrossmint } from '@crossmint/client-sdk-react-ui';
import bs58 from 'bs58';
import { PublicKey, type VersionedTransaction } from '@solana/web3.js';
import OTPDialog from '../components/OTPDialog';

// Simple initializing component to show while connecting to the iframe
const InitializingComponent = () => (
  <div className="flex flex-col items-center justify-center p-4">
    <div className="w-10 h-10 border-4 border-t-transparent border-current rounded-full animate-spin mb-4" />
    <p className="text-cm-text-secondary text-center">Initializing secure connection...</p>
  </div>
);

async function createIFrame(url: string): Promise<HTMLIFrameElement> {
  const iframe = document.createElement('iframe');
  iframe.src = url;

  // Make the iframe completely invisible
  iframe.style.position = 'absolute';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';

  return new Promise((resolve, reject) => {
    iframe.onload = () => resolve(iframe);
    iframe.onerror = () => reject('Failed to load iframe content');

    document.body.appendChild(iframe);
  });
}

const defaultEventOptions = {
  timeoutMs: 10_000,
  intervalMs: 5_000,
};

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
    typeof signerOutboundEvents,
    typeof signerInboundEvents
  > | null>(null);

  // Close OTP dialog when signer is created
  useEffect(() => {
    if (solanaSigner != null && otpDialogOpen) {
      setOtpDialogOpen(false);
    }
  }, [solanaSigner, otpDialogOpen]);

  const initIFrameWindow = useCallback(async () => {
    if (iframe.current == null) {
      try {
        setIsInitializing(true);
        const iframe = await createIFrame(iframeUrl.toString());
        iframeWindow.current = await IFrameWindow.init(iframe, {
          targetOrigin: iframeUrl.origin,
          incomingEvents: signerOutboundEvents,
          outgoingEvents: signerInboundEvents,
        });

        await iframeWindow.current.handshakeWithChild();
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize or connect to iframe:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsInitializing(false);
      }
    }
  }, [iframeUrl.origin, iframeUrl]);

  const buildSolanaSigner = (address: string) => {
    return {
      address,
      publicKey: new PublicKey(address),
      signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
        try {
          assertInitialized();
          const response = await iframeWindow.current?.sendAction({
            event: 'request:sign-message',
            responseEvent: 'response:sign-message',
            data: {
              authData: {
                jwt: jwt as NonNullable<typeof jwt>,
                apiKey,
              },
              data: {
                message: bs58.encode(message),
                chainLayer: 'solana',
                encoding: 'base58',
              },
            },
            options: defaultEventOptions,
          });
          if (!response || response.status === 'error' || !response.signature) {
            throw new Error('Failed to sign message');
          }
          return bs58.decode(response.signature);
        } catch (error) {
          console.error('Failed to sign message:', error);
          throw error;
        }
      },
      signTransaction: async (transaction: VersionedTransaction): Promise<VersionedTransaction> => {
        try {
          console.log('signTransaction called for address:', address);

          // Basic validations
          assertInitialized();
          if (!iframeWindow.current) {
            throw new Error('iframeWindow is not initialized');
          }

          // Get serialized transaction
          const serializedTx = bs58.encode(transaction.serialize());
          console.log(`Transaction serialized: ${serializedTx.substring(0, 20)}...`);

          // Prepare request
          const requestData = {
            authData: {
              jwt: jwt as NonNullable<typeof jwt>,
              apiKey,
            },
            data: {
              transaction: serializedTx,
              chainLayer: 'solana' as const,
              encoding: 'base58' as const,
            },
          };
          console.log('Request prepared');

          // Send request
          console.log('Sending signature request');
          const response = await iframeWindow.current.sendAction({
            event: 'request:sign-transaction',
            responseEvent: 'response:sign-transaction',
            data: requestData,
            options: defaultEventOptions,
          });
          console.log('Response received:', response);

          // Validate response
          if (!response || response.status === 'error' || !response.signature) {
            throw new Error('Failed to sign transaction: No signature returned');
          }

          // Add signature to transaction
          const signerPublicKey = new PublicKey(address);
          const signature = bs58.decode(response.signature);
          console.log('Adding signature to transaction');
          transaction.addSignature(signerPublicKey, signature);

          return transaction;
        } catch (error) {
          console.error('Failed to sign transaction:', error);
          throw error;
        }
      },
    };
  };

  const assertInitialized = () => {
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

  // Initialize signer manually (instead of auto-init)
  const initSigner = useCallback(() => {
    try {
      if (isInitializingSigner || !jwt || !apiKey) {
        return;
      }

      // Initialize the iframe window if not already done
      if (!isInitialized && !isInitializing) {
        initIFrameWindow().then(() => {
          setOtpDialogOpen(true);
        });
      } else {
        setOtpDialogOpen(true);
      }
    } catch (error) {
      console.error('Error creating signer:', error);
      throw error;
    }
  }, [isInitialized, isInitializing, isInitializingSigner, jwt, apiKey, initIFrameWindow]);

  // Handle OTP dialog event handlers
  const handleCreateSignerEvent = async () => {
    assertInitialized();
    if (iframeWindow.current == null || jwt == null || apiKey == null) {
      throw new Error('Failed to create signer. The component has not been initialized');
    }
    const response = await iframeWindow.current?.sendAction({
      event: 'request:create-signer',
      responseEvent: 'response:create-signer',
      data: {
        authData: {
          jwt: jwt as NonNullable<typeof jwt>,
          apiKey,
        },
        data: {
          authId: user?.email ? `email:${user.email}` : user?.id || '',
          chainLayer: 'solana',
        },
      },
    });

    if (response?.status === 'success' && response.address) {
      handleAddressFetched(response.address);
    }
  };

  const handleEncryptedOtpEvent = async (encryptedOtp: string, chainLayer: 'solana') => {
    assertInitialized();
    if (iframeWindow.current == null || jwt == null || apiKey == null) {
      throw new Error('Failed to create signer. The component has not been initialized');
    }
    const response = await iframeWindow.current.sendAction({
      event: 'request:send-otp',
      responseEvent: 'response:send-otp',
      data: {
        authData: {
          jwt,
          apiKey,
        },
        data: {
          encryptedOtp,
          chainLayer,
        },
      },
    });
    if (!response || response.status === 'error' || !response.address) {
      throw new Error('Failed to validate encrypted OTP');
    }
    return response.address;
  };

  const handleAddressFetched = (address: string) => {
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
