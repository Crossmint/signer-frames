import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './Dialog';

// Simple spinner component
const Spinner = () => (
  <svg
    className="animate-spin h-5 w-5 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="img"
    aria-label="Loading spinner"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

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
    success: '#4CAF50',
  },
  borderRadius: '12px',
};

export default function SignMessageDialog({
  open,
  onClose,
  onSignMessage,
}: {
  open: boolean;
  onClose: () => void;
  onSignMessage: (message: string) => Promise<string>;
}) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const handleSignMessage = async () => {
    if (!message.trim()) {
      setError('Please enter a message to sign');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const signedMessage = await onSignMessage(message);
      setSignature(signedMessage);
    } catch (err) {
      setError('Failed to sign message. Please try again.');
      console.error('Error signing message:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMessage('');
    setSignature(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog modal={false} open={open}>
      <DialogContent
        onInteractOutside={e => e.preventDefault()}
        onOpenAutoFocus={e => e.preventDefault()}
        className="!p-6 !min-[480px]:p-6"
      >
        <DialogHeader className="mb-4">
          <DialogTitle className="text-center">Sign a Message</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md text-sm text-center">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center">
          <p className="text-gray-600 text-center mb-6">
            {signature ? 'Message successfully signed!' : 'Enter a message to sign with your key'}
          </p>

          {!signature ? (
            <>
              <div className="w-full mb-4">
                <textarea
                  value={message}
                  onChange={e => {
                    setMessage(e.target.value);
                    setError(null);
                  }}
                  disabled={loading}
                  className="w-full p-4 text-sm rounded-lg h-24 border border-gray-300 focus:ring focus:ring-indigo-200 focus:border-indigo-500 outline-none"
                  placeholder="Enter message here..."
                />
              </div>

              <button
                type="button"
                onClick={handleSignMessage}
                disabled={loading}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-200 flex items-center justify-center disabled:opacity-70"
              >
                {loading ? (
                  <span className="flex items-center">
                    <Spinner />
                    <span className="ml-2">Signing...</span>
                  </span>
                ) : (
                  <span>Sign Message</span>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="w-full mb-4 bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium mb-1">Message:</p>
                <p className="text-sm break-all bg-white p-2 rounded border border-gray-200">
                  {message}
                </p>
              </div>

              <div className="w-full mb-4 bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium mb-1">Signature:</p>
                <p className="text-sm break-all font-mono bg-white p-2 rounded border border-green-200">
                  {signature}
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 px-6 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-all duration-200"
              >
                Close
              </button>
            </>
          )}
        </div>

        <DialogFooter className="mt-6 text-center text-sm text-gray-500">
          <div>
            {signature
              ? 'Your message has been signed with your Solana key'
              : 'Messages are signed with your secure Solana key'}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
