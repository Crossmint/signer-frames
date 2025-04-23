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
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-center text-gray-800">Crossmint Authentication</h2>
      </div>

      <div className="p-5">
        <div className="flex justify-center mb-6">
          {user == null ? (
            <button
              type="button"
              onClick={login}
              onKeyDown={e => e.key === 'Enter' && login()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              Login with Crossmint
            </button>
          ) : (
            <button
              type="button"
              onClick={logout}
              onKeyDown={e => e.key === 'Enter' && logout()}
              className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-300"
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
              <span className="text-gray-800 font-mono overflow-hidden text-ellipsis">
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
              <div className="bg-gray-200 p-2 rounded font-mono text-xs text-gray-700 max-h-24 overflow-auto break-all">
                {jwt ? `${jwt.slice(0, 40)}...` : 'No JWT available'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
