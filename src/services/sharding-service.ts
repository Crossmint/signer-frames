import { combine } from "shamir-secret-sharing";
import { Ed25519Service } from "./ed25519";
import { base64Decode } from "../utils";

// Supported chain layers
export type ChainLayer = "solana" | "evm";

// Key shard structure
export interface KeyShard {
	data: string;
}

export interface RecombinedKeys {
	privateKey: Uint8Array;
	publicKey: string;
}

export class ShardingService {
	constructor(
		private readonly ed25519Service: Ed25519Service = new Ed25519Service(),
	) {}

	public getOrCreateDeviceId(): string {
		console.log("[ShardingService] Attempting to get device ID from storage");

		const existing = localStorage.getItem("deviceId");
		if (existing != null) {
			console.log("[ShardingService] Found existing device ID:", existing);
			return existing;
		}

		console.log(
			"[ShardingService] No existing device ID found, generating new one",
		);
		const deviceId = crypto.randomUUID();
		localStorage.setItem("deviceId", deviceId);
		console.log("[ShardingService] Successfully stored new device ID");
		return deviceId;
	}

	/**
	 * Recombines key shards to recover the private key and derive the public key
	 * @param shard1 First key shard
	 * @param shard2 Second key shard
	 * @param chainLayer The blockchain layer (solana, evm, etc.)
	 * @returns The recombined private key and public key
	 */
	async recombineShards(
		shard1: Uint8Array,
		shard2: Uint8Array,
		chainLayer: ChainLayer,
	): Promise<RecombinedKeys> {
		try {
			const privateKey = await combine([shard1, shard2]);
			const publicKey = await this.computePublicKey(privateKey, chainLayer);
			return {
				privateKey,
				publicKey,
			};
		} catch (error) {
			throw new Error(
				`Failed to recombine key shards: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async reconstructKey(
		authShare: string,
		chainLayer: ChainLayer,
	): Promise<RecombinedKeys> {
		const deviceShare = this.getDeviceShare();
		if (!deviceShare) {
			throw new Error("Device share not found");
		}

		return this.recombineShards(
			base64Decode(deviceShare),
			base64Decode(authShare),
			chainLayer,
		);
	}

	/**
	 * Computes a public key from a private key for a specific chain
	 * @param privateKey The private key as Uint8Array
	 * @param chainLayer The blockchain layer (solana, evm, etc.)
	 * @returns The formatted public key as a string
	 */
	private async computePublicKey(
		privateKey: Uint8Array,
		chainLayer: ChainLayer,
	): Promise<string> {
		if (privateKey.length !== 32) {
			throw new Error(
				`Invalid private key length: ${privateKey.length}. Expected 32 bytes.`,
			);
		}

		switch (chainLayer) {
			case "solana":
				return await this.ed25519Service.getPublicKey(privateKey);
			case "evm":
				throw new Error("EVM key derivation not yet implemented");
			default:
				throw new Error(`Unsupported chain layer: ${chainLayer}`);
		}
	}

	/**
	 * Stores a device key shard in the local storage. It does not expire
	 * @param shard The key shard to store
	 */
	async storeDeviceShare(share: string): Promise<void> {
		localStorage.setItem("device-share", share);
	}

	/**
	 * Stores an auth key shard in the local storage. Expires in 5 minutes
	 * @param shard The key shard to store
	 */
	async cacheAuthShare(share: string): Promise<void> {
		sessionStorage.setItem("auth-share", share);
	}

	/**
	 * Retrieves a device key shard from local storage
	 * @param shardId The ID of the shard to retrieve
	 * @returns The key shard or null if not found
	 */
	getDeviceShare(): string | null {
		return localStorage.getItem("device-share");
	}

	/**
	 * Retrieves an auth key shard from local storage
	 * @param shardId The ID of the shard to retrieve
	 * @returns The key shard or null if not found
	 */
	getCachedAuthShare(): string | null {
		return sessionStorage.getItem("auth-share");
	}
}
