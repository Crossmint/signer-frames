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
import { v4 as uuidv4 } from 'uuid';
import OTPDialog from '../components/OTPDialog';
import SignMessageDialog from '../components/SignMessageDialog';

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
  deviceId: string | null;
  setDeviceId: (deviceId: string) => void;
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
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [signMessageDialogOpen, setSignMessageDialogOpen] = useState(false);
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
      // Show sign message dialog after signer is created
      setSignMessageDialogOpen(true);
    }
  }, [solanaSigner, otpDialogOpen]);

  // Load deviceId from localStorage on component mount
  useEffect(() => {
    const storedDeviceId = localStorage.getItem('deviceId');
    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
    }
  }, []);

  // Update deviceId in state and localStorage
  const updateDeviceId = useCallback((newDeviceId: string) => {
    localStorage.setItem('deviceId', newDeviceId);
    setDeviceId(newDeviceId);
  }, []);

  // Generate a new device ID
  const generateNewDeviceId = useCallback(() => {
    const newDeviceId = uuidv4();
    updateDeviceId(newDeviceId);
    return newDeviceId;
  }, [updateDeviceId]);

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
          if (deviceId == null) {
            throw new Error('Device ID not initialized');
          }
          const response = await iframeWindow.current?.sendAction({
            event: 'request:sign-message',
            responseEvent: 'response:sign-message',
            data: {
              deviceId,
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
          if (response?.signature == null) {
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
          assertInitialized();
          if (deviceId == null || solanaSigner == null) {
            throw new Error('Device ID or Solana signer not initialized');
          }
          const response = await iframeWindow.current?.sendAction({
            event: 'request:sign-transaction',
            responseEvent: 'response:sign-transaction',
            data: {
              deviceId,
              authData: {
                jwt: jwt as NonNullable<typeof jwt>,
                apiKey,
              },
              data: {
                transaction: bs58.encode(transaction.serialize()),
                chainLayer: 'solana',
                encoding: 'base58',
              },
            },
            options: defaultEventOptions,
          });
          if (response?.signature == null) {
            throw new Error('Failed to sign transaction');
          }
          transaction.addSignature(
            new PublicKey(solanaSigner.address),
            bs58.decode(response.signature)
          );
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

  const initSigner = useCallback(() => {
    try {
      if (isInitializingSigner || !jwt || !apiKey) {
        return;
      }

      // Always generate a new device ID when creating a new signer
      generateNewDeviceId();

      setIsInitializingSigner(true);
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
  }, [
    isInitialized,
    isInitializing,
    isInitializingSigner,
    jwt,
    apiKey,
    initIFrameWindow,
    generateNewDeviceId,
  ]);

  // Automatically initialize signer after login - moved here after initSigner is defined
  useEffect(() => {
    if (jwt && apiKey && !solanaSigner && !isInitializing && !isInitializingSigner) {
      initSigner();
    }
  }, [jwt, apiKey, solanaSigner, isInitializing, isInitializingSigner, initSigner]);

  // Handle OTP dialog event handlers
  const handleCreateSignerEvent = async () => {
    assertInitialized();
    if (iframeWindow.current == null || jwt == null || apiKey == null) {
      throw new Error('Failed to create signer. The component has not been initialized');
    }
    if (deviceId == null) {
      throw new Error('Device ID not initialized');
    }
    await iframeWindow.current?.sendAction({
      event: 'request:create-signer',
      responseEvent: 'response:create-signer',
      data: {
        deviceId,
        authData: {
          jwt: jwt as NonNullable<typeof jwt>,
          apiKey,
        },
        data: {
          authId: `email:${user?.email}`,
        },
      },
    });
  };

  const handleEncryptedOtpEvent = async (encryptedOtp: string, chainLayer: 'solana') => {
    assertInitialized();
    if (iframeWindow.current == null || jwt == null || apiKey == null || deviceId == null) {
      throw new Error('Failed to create signer. The component has not been initialized');
    }
    const response = await iframeWindow.current.sendAction({
      event: 'request:send-otp',
      responseEvent: 'response:send-otp',
      data: {
        deviceId,
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
    if (response?.address == null) {
      throw new Error('Failed to validate encrypted OTP');
    }
    return response.address;
  };

  const handleAddressFetched = (address: string) => {
    setSolanaSigner(buildSolanaSigner(address));
    setOtpDialogOpen(false);
    setIsInitializingSigner(false);
    // Open sign message dialog immediately after signer creation
    setSignMessageDialogOpen(true);
  };

  const handleSignMessage = async (message: string): Promise<string> => {
    if (!solanaSigner) {
      throw new Error('Signer not initialized');
    }

    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = await solanaSigner.signMessage(messageBytes);
    return bs58.encode(signatureBytes);
  };

  const handleCloseSignMessageDialog = () => {
    setSignMessageDialogOpen(false);
  };

  return (
    <>
      <CrossmintSignerContext.Provider
        value={{
          error,
          initSigner,
          solanaSigner,
          deviceId,
          setDeviceId: updateDeviceId,
        }}
      >
        <>
          {isInitializing && <InitializingComponent />}
          {isInitialized && (
            <>
              <OTPDialog
                open={otpDialogOpen}
                sendCreateSignerEvent={handleCreateSignerEvent}
                sendEncryptedOtpEvent={handleEncryptedOtpEvent}
                onAddressFetched={handleAddressFetched}
              />
              <SignMessageDialog
                open={signMessageDialogOpen}
                onClose={handleCloseSignMessageDialog}
                onSignMessage={handleSignMessage}
              />
            </>
          )}
          {children}
        </>
      </CrossmintSignerContext.Provider>
    </>
  );
}
