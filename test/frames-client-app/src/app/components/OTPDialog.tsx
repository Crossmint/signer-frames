import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from './Dialog';
import { useCrossmintSigner } from '../providers/CrossmintSignerProvider';

// Simple spinner component
const Spinner = ({ style }: { style?: React.CSSProperties }) => (
  <svg
    aria-hidden="true"
    className="w-6 h-6 animate-spin"
    style={style}
    viewBox="0 0 100 101"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
      fill="currentColor"
    />
    <path
      d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
      fill="currentFill"
    />
  </svg>
);

// Simple OTP input components
const InputOTP = ({
  maxLength,
  value,
  onChange,
  onComplete,
  disabled,
  customStyles,
  children,
}: {
  maxLength: number;
  value: string;
  onChange: (val: string) => void;
  onComplete?: () => void;
  disabled?: boolean;
  customStyles?: any;
  children: React.ReactNode;
}) => {
  return <div className="flex items-center gap-2">{children}</div>;
};

const InputOTPGroup = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 items-center">{children}</div>
);

const InputOTPSlot = ({ index, hasError }: { index: number; hasError?: boolean }) => {
  return (
    <input
      type="text"
      maxLength={1}
      className="relative flex h-14 w-12 items-center justify-center border text-lg transition-all rounded-md text-center"
      style={{
        borderColor: hasError ? 'red' : 'gray',
      }}
    />
  );
};

// Default UI theme
const defaultTheme = {
  colors: {
    textPrimary: '#1A1A1A',
    textSecondary: '#67797F',
    buttonBackground: '#F7F7F7',
    background: '#FFFFFF',
    inputBackground: '#FFFFFF',
    accent: '#04AA6D',
    border: '#E5E7EB',
    danger: '#F44336',
  },
  borderRadius: '12px',
};

export default function OTPDialog({
  open,
  sendCreateSignerEvent,
  sendEncryptedOtpEvent,
  onAddressFetched,
}: {
  open: boolean;
  sendCreateSignerEvent: () => Promise<void>;
  sendEncryptedOtpEvent: (otp: string, chainLayer: 'solana') => Promise<string>;
  onAddressFetched: (address: string) => void;
}) {
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  // Automatically start signer creation when dialog opens if device ID is available
  useEffect(() => {
    if (open && !showOtpInput && !loading) {
      handleCreateSigner();
    }
  }, [open, showOtpInput, loading]);

  // Clear dialog state when closed
  useEffect(() => {
    if (!open) {
      setShowOtpInput(false);
      setOtp('');
      setLoading(false);
      setError(null);
      setHasError(false);
    }
  }, [open]);

  const handleCreateSigner = async () => {
    setLoading(true);
    setError(null);

    try {
      await sendCreateSignerEvent();
      setShowOtpInput(true);
    } catch (err) {
      setError('Failed to create signer. Please try again.');
      console.error('Error creating signer:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOtp = async () => {
    if (otp.length !== 9) {
      setError('Please enter a 9-digit code');
      setHasError(true);
      return;
    }

    setLoading(true);
    setError(null);
    setHasError(false);

    try {
      const address = await sendEncryptedOtpEvent(otp, 'solana');
      onAddressFetched(address);
    } catch (err) {
      setError('Invalid code. Please try again.');
      setHasError(true);
      console.error('Error with OTP:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog modal={false} open={open}>
      <DialogContent
        onInteractOutside={e => e.preventDefault()}
        onOpenAutoFocus={e => e.preventDefault()}
        className="!p-6 !min-[480px]:p-6"
      >
        <DialogHeader className="mb-4">
          <DialogTitle className="text-center">
            {showOtpInput ? 'Enter Verification Code' : 'Creating Signer'}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div
            className="mb-4 p-2 bg-red-100 text-red-700 rounded-md text-sm text-center"
            style={{
              backgroundColor: `${defaultTheme.colors.danger}20`,
              color: defaultTheme.colors.danger,
            }}
          >
            {error}
          </div>
        )}

        {!showOtpInput ? (
          <div className="flex flex-col items-center">
            <p className="text-cm-text-secondary text-center mb-6">
              {loading ? 'Creating your secure signer...' : 'Preparing to create your signer'}
            </p>

            <div className="flex justify-center py-6">
              {loading && (
                <Spinner
                  style={{
                    color: defaultTheme.colors?.textSecondary,
                    fill: defaultTheme.colors?.textPrimary,
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <p className="text-cm-text-secondary text-center mb-6">
              Please enter the 9-digit verification code
            </p>

            <div className="py-4">
              <input
                type="text"
                maxLength={9}
                value={otp}
                onChange={e => {
                  setOtp(e.target.value);
                  setHasError(false);
                  setError(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && otp.length === 6) {
                    handleSubmitOtp();
                  }
                }}
                disabled={loading}
                className="w-full p-4 text-center rounded-xl"
                style={{
                  borderRadius: defaultTheme.borderRadius,
                  backgroundColor: defaultTheme.colors?.inputBackground ?? '#FFFFFF',
                  color: defaultTheme.colors?.textPrimary ?? '#909ca3',
                  border: `1px solid ${hasError ? (defaultTheme.colors?.danger ?? '#f44336') : (defaultTheme.colors?.border ?? '#E5E7EB')}`,
                }}
                placeholder="Enter 9-digit code"
              />
            </div>

            {loading && (
              <div className="flex justify-center py-2">
                <Spinner
                  style={{
                    color: defaultTheme.colors?.textSecondary,
                    fill: defaultTheme.colors?.textPrimary,
                  }}
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmitOtp}
              disabled={loading || otp.length !== 9}
              className="relative flex text-base p-4 bg-cm-muted-primary text-cm-text-primary items-center w-full rounded-xl justify-center hover:bg-cm-hover focus:bg-cm-hover outline-none mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderRadius: defaultTheme.borderRadius,
                backgroundColor: defaultTheme.colors?.buttonBackground,
                color: defaultTheme.colors?.textPrimary,
              }}
            >
              <span className="font-medium">Submit</span>
            </button>
          </div>
        )}

        <DialogFooter className="mt-6 text-center text-sm text-cm-text-secondary">
          <div style={{ color: defaultTheme.colors?.textSecondary }}>
            {showOtpInput
              ? 'Please enter the verification code to complete the process.'
              : "You'll need to confirm this action with a verification code."}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
