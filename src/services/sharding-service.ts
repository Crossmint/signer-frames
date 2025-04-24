import { CrossmintApiService } from "./api";
import { StorageService } from "./storage";
import { combine } from "shamir-secret-sharing";
import { Stores } from "./storage";
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
		private readonly storageService: StorageService = new StorageService(),
		private readonly ed25519Service: Ed25519Service = new Ed25519Service(),
	) {}

	async init(): Promise<void> {
		await this.storageService.initDatabase();
	}

	// here
	public async getOrCreateDeviceId(): Promise<string> {
		console.log("[ShardingService] Attempting to get device ID from storage");

		const item = await this.storageService.getItem(Stores.SETTINGS, "deviceId");
		if (item != null) {
			console.log("[ShardingService] Found existing device ID:", item.deviceId);
			return item.deviceId as string;
		}

		console.log(
			"[ShardingService] No existing device ID found, generating new one",
		);
		const deviceId = crypto.randomUUID();
		console.log("[ShardingService] Generated new device ID:", deviceId);

		console.log("[ShardingService] Storing new device ID in settings store");
		await this.storageService.storeItem(Stores.SETTINGS, {
			id: "deviceId",
			deviceId,
		});
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
		authShard: KeyShard,
		chainLayer: ChainLayer,
	): Promise<RecombinedKeys> {
		const { data } = authShard;
		const deviceId = await this.getOrCreateDeviceId();
		const deviceShard = await this.getDeviceKeyShardFromLocal(deviceId);
		if (!deviceShard) {
			throw new Error(
				`Device shard not found in IndexedDB for deviceId: ${deviceId}`,
			);
		}
		return this.recombineShards(
			base64Decode(deviceShard.data),
			base64Decode(data),
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
	async storeDeviceKeyShardLocally(shard: KeyShard): Promise<void> {
		await this.storeKeyShardLocallyInStore(shard, Stores.DEVICE_SHARES);
	}

	/**
	 * Stores an auth key shard in the local storage. Expires in 5 minutes
	 * @param shard The key shard to store
	 */
	async storeAuthKeyShardLocally(shard: KeyShard): Promise<void> {
		await this.storeKeyShardLocallyInStore(
			shard,
			Stores.AUTH_SHARES,
			60 * 5 * 1_000,
		);
	}

	private async storeKeyShardLocallyInStore(
		shard: KeyShard,
		storeName: Stores,
		expiresIn?: number,
	): Promise<void> {
		await this.storageService.storeItem(
			storeName,
			{
				id: "1",
				data: shard.data,
				type: "base64KeyShard",
				created: Date.now(),
			},
			expiresIn,
		);
	}

	/**
	 * Retrieves a device key shard from local storage
	 * @param shardId The ID of the shard to retrieve
	 * @returns The key shard or null if not found
	 */
	async getDeviceKeyShardFromLocal(shardId: string): Promise<KeyShard | null> {
		return this.getShardFromStore(Stores.DEVICE_SHARES);
	}

	/**
	 * Retrieves an auth key shard from local storage
	 * @param shardId The ID of the shard to retrieve
	 * @returns The key shard or null if not found
	 */
	async tryGetAuthKeyShardFromLocal(): Promise<KeyShard | null> {
		return this.getShardFromStore(Stores.AUTH_SHARES);
	}

	private async getShardFromStore(storeName: Stores): Promise<KeyShard | null> {
		const item = await this.storageService.getItem(storeName, "1");

		if (!item) {
			return null;
		}

		return {
			data: item.data as string,
		};
	}
}
