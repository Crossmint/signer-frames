"use client";

import React from "react";
import { useAuth } from "@crossmint/client-sdk-react-ui";
import { useCrossmintSigner } from "../providers/CrossmintSignerProvider";
import SignMessageForm from "./SignMessageForm";

interface ExtendedUser {
	id: string;
	email?: string;
	phoneNumber?: string;
	[key: string]: unknown;
}

export default function SignerPage() {
	const { logout, user } = useAuth();
	const { initSigner, solanaSigner } = useCrossmintSigner();

	// Handler for creating a signer
	const handleCreateSigner = () => {
		initSigner("solana");
	};

	// Get display name from user object
	const getUserDisplayName = () => {
		const typedUser = user as ExtendedUser;
		return (
			typedUser?.email ||
			typedUser?.phoneNumber ||
			typedUser?.id ||
			"Unknown User"
		);
	};

	return (
		<main className="min-h-screen p-6 bg-gray-50">
			<div className="max-w-2xl mx-auto">
				{/* Header with user info and logout */}
				<header className="bg-white p-4 rounded-lg shadow-sm mb-6">
					<div className="flex justify-between items-center">
						<h1 className="text-xl font-bold">Frames Testing App</h1>
						<button
							type="button"
							onClick={logout}
							className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
						>
							Logout
						</button>
					</div>
					<div className="mt-2 text-sm text-gray-600">
						Logged in as:{" "}
						<span className="font-medium">{getUserDisplayName()}</span>
					</div>
					{solanaSigner?.address && (
						<div className="mt-1 text-sm text-gray-600">
							Signer Address:{" "}
							<span className="font-mono">{solanaSigner.address}</span>
						</div>
					)}
				</header>

				{/* Device ID input and signer creation */}
				{!solanaSigner ? (
					<div className="bg-white p-6 rounded-lg shadow-sm mb-6">
						<h2 className="text-lg font-semibold mb-4">Create Signer</h2>
						<div className="mb-4" />
						<button
							type="button"
							onClick={handleCreateSigner}
							className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
						>
							Create Signer
						</button>
					</div>
				) : (
					<SignMessageForm />
				)}
			</div>
		</main>
	);
}
