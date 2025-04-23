'use client';

import { useAuth } from '@crossmint/client-sdk-react-ui';

// Extended user interface to include optional fields from different auth providers
interface ExtendedUser {
  id: string;
  email?: string;
  phoneNumber?: string;
  farcaster?: { username?: string };
  google?: { displayName?: string };
}

export default function AuthButton() {
  const { login, logout, user, jwt } = useAuth();

  // Cast the user to our extended interface
  const extendedUser = user as unknown as ExtendedUser;

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 space-y-6">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
        Crossmint Authentication
      </h2>

      <div className="flex justify-center mb-8">
        {user == null ? (
          <button
            type="button"
            onClick={login}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Login with Crossmint
          </button>
        ) : (
          <button
            type="button"
            onClick={logout}
            className="bg-black hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-lg border-2 border-blue-500 transition duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Logout
          </button>
        )}
      </div>

      {user != null && (
        <div className="space-y-3 bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">User Profile</h3>

          <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
            <span className="font-medium text-gray-600">User ID:</span>
            <span className="text-gray-800 font-mono overflow-hidden overflow-ellipsis">
              {extendedUser.id}
            </span>

            <span className="font-medium text-gray-600">Email:</span>
            <span className="text-gray-800">{extendedUser.email ?? 'Not provided'}</span>

            <span className="font-medium text-gray-600">Phone:</span>
            <span className="text-gray-800">{extendedUser.phoneNumber ?? 'Not provided'}</span>

            <span className="font-medium text-gray-600">Farcaster:</span>
            <span className="text-gray-800">
              {extendedUser.farcaster?.username ?? 'Not connected'}
            </span>

            <span className="font-medium text-gray-600">Google:</span>
            <span className="text-gray-800">
              {extendedUser.google?.displayName ?? 'Not connected'}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-gray-500 mb-1 font-medium">JSON Web Token:</p>
            <div className="bg-gray-200 p-2 rounded font-mono text-xs text-gray-700 max-h-24 overflow-auto">
              {jwt ? `${jwt}...` : 'No JWT available'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
