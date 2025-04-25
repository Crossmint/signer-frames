import type {
	SignerIFrameEventName,
	SignerInputEvent,
	SignerOutputEvent,
} from "@crossmint/client-signers";
import type { CrossmintApiService } from "./api";
import type { ShardingService } from "./sharding-service";
import { base64Decode } from "../utils";
import type { Ed25519Service } from "./ed25519";
const DEFAULT_TIMEOUT_MS = 10_000;

const measureFunctionTime = async <T>(
	fnName: string,
	fn: () => Promise<T>,
): Promise<T> => {
	const start = performance.now();
	const result = await fn();
	const end = performance.now();
	console.log(`Function ${fnName} took ${end - start}ms to execute`);
	return result;
};

export interface EventHandler {
	event: `request:${SignerIFrameEventName}`;
	responseEvent: `response:${SignerIFrameEventName}`;
	callback: (
		payload: SignerInputEvent<SignerIFrameEventName>,
	) => Promise<SignerOutputEvent<SignerIFrameEventName>>;
	options: {
		timeoutMs?: number;
	};
}

abstract class BaseEventHandler<EventName extends SignerIFrameEventName> {
	abstract event: `request:${EventName}`;
	abstract responseEvent: `response:${EventName}`;
	abstract handler(
		payload: SignerInputEvent<EventName>,
	): Promise<SignerOutputEvent<EventName>>;
	async callback(
		payload: SignerInputEvent<EventName>,
	): Promise<SignerOutputEvent<EventName>> {
		const result = await measureFunctionTime(
			`[${this.event} handler]`,
			async () => this.handler(payload),
		);
		return result;
	}
	options = {
		timeoutMs: DEFAULT_TIMEOUT_MS,
	};
}

export class CreateSignerEventHandler extends BaseEventHandler<"create-signer"> {
	constructor(
		private readonly api: CrossmintApiService,
		private readonly shardingService: ShardingService,
	) {
		super();
	}
	event = "request:create-signer" as const;
	responseEvent = "response:create-signer" as const;
	async handler(payload: SignerInputEvent<"create-signer">) {
		if (!this.api) {
			throw new Error("API service is not available");
		}

		console.log("local storage items");
		console.log(localStorage.getItem("deviceId"));
		console.log(localStorage.getItem("device-share"));
		console.log(localStorage.getItem("auth-share"));

		const deviceId = this.shardingService.getOrCreateDeviceId();
		// if (this.shardingService.getDeviceShare() != null) {
		// 	return {};
		// }

		await this.api.createSigner(deviceId, payload.authData, payload.data);
		return {};
	}
}

export class SendOtpEventHandler extends BaseEventHandler<"send-otp"> {
	constructor(
		private readonly api: CrossmintApiService,
		private readonly shardingService: ShardingService,
	) {
		super();
	}
	event = "request:send-otp" as const;
	responseEvent = "response:send-otp" as const;
	handler = async (payload: SignerInputEvent<"send-otp">) => {
		const deviceId = this.shardingService.getOrCreateDeviceId();
		const response = await this.api.sendOtp(deviceId, payload.authData, {
			otp: payload.data.encryptedOtp,
		});

		this.shardingService.storeDeviceShare(response.shares.device);
		this.shardingService.cacheAuthShare(response.shares.auth);

		const { publicKey } = await this.shardingService.recombineShards(
			base64Decode(response.shares.device),
			base64Decode(response.shares.auth),
			payload.data.chainLayer,
		);
		return {
			address: publicKey,
		};
	};
}

export class GetPublicKeyEventHandler extends BaseEventHandler<"get-public-key"> {
	constructor(
		private readonly api: CrossmintApiService,
		private readonly shardingService: ShardingService,
	) {
		super();
	}
	event = "request:get-public-key" as const;
	responseEvent = "response:get-public-key" as const;
	handler = async (payload: SignerInputEvent<"get-public-key">) => {
		let authShare = await this.shardingService.getCachedAuthShare();
		const deviceId = await this.shardingService.getOrCreateDeviceId();
		if (!authShare) {
			const { keyShare } = await this.api.getAuthShare(
				deviceId,
				payload.authData,
			);
			authShare = keyShare;
			await this.shardingService.cacheAuthShare(keyShare);
		}

		const { publicKey } = await this.shardingService.reconstructKey(
			authShare,
			payload.data.chainLayer,
		);
		return {
			publicKey,
		};
	};
}

export class SignMessageEventHandler extends BaseEventHandler<"sign-message"> {
	constructor(
		private readonly api: CrossmintApiService,
		private readonly shardingService: ShardingService,
		private readonly ed25519Service: Ed25519Service,
	) {
		super();
	}
	event = "request:sign-message" as const;
	responseEvent = "response:sign-message" as const;
	async handler(payload: SignerInputEvent<"sign-message">) {
		console.log("[SignMessageEventHandler] Starting message signing process");
		console.log("[SignMessageEventHandler] Checking for cached auth shard");
		const deviceId = await this.shardingService.getOrCreateDeviceId();
		let authShare = await this.shardingService.getCachedAuthShare();
		if (!authShare) {
			console.log(
				"[SignMessageEventHandler] No cached auth shard found, fetching from API",
			);
			const { keyShare } = await this.api.getAuthShare(
				deviceId,
				payload.authData,
			);
			console.log("[SignMessageEventHandler] Storing new auth shard locally");
			console.log("[SignMessageEventHandler] Auth shard:", authShare);
			authShare = keyShare;
			await this.shardingService.cacheAuthShare(keyShare);
		} else {
			console.log("[SignMessageEventHandler] Using cached auth shard");
			console.log("[SignMessageEventHandler] Cached auth shard:", authShare);
		}
		console.log("[SignMessageEventHandler] Reconstructing key pair");
		const { privateKey, publicKey } = await this.shardingService.reconstructKey(
			authShare,
			payload.data.chainLayer,
		);
		if (payload.data.chainLayer === "solana") {
			console.log("[SignMessageEventHandler] Signing message for Solana chain");
			const signature = await this.ed25519Service.signMessage(
				payload.data.message,
				privateKey,
			);
			console.log("[SignMessageEventHandler] Message signing complete");
			return { signature, publicKey };
		}
		console.error(
			"[SignMessageEventHandler] Unsupported chain layer:",
			payload.data.chainLayer,
		);
		throw new Error("Chain layer not implemented");
	}
}

export class SignTransactionEventHandler extends BaseEventHandler<"sign-transaction"> {
	event = "request:sign-transaction" as const;
	responseEvent = "response:sign-transaction" as const;
	handler = async (payload: SignerInputEvent<"sign-transaction">) => {
		throw new Error("Not implemented");
	};
}
