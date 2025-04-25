import type {
	SignerIFrameEventName,
	SignerInputEvent,
	SignerOutputEvent,
} from "@crossmint/client-signers";
import type { CrossmintApiService } from "./api";
import type { ShardingService } from "./sharding-service";
import { base58Decode, base58Encode } from "../utils";
import type { Ed25519Service } from "./ed25519";
import { Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
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

		const deviceId = this.shardingService.getDeviceId();
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
		const deviceId = this.shardingService.getDeviceId();
		const response = await this.api.sendOtp(deviceId, payload.authData, {
			otp: payload.data.encryptedOtp,
		});

		this.shardingService.storeDeviceShare(response.shares.device);
		this.shardingService.cacheAuthShare(response.shares.auth);

		const { publicKey } = await this.shardingService.getLocalKeyInstance(
			payload.authData,
			payload.data.chainLayer,
		);
		return {
			address: publicKey,
		};
	};
}

export class GetPublicKeyEventHandler extends BaseEventHandler<"get-public-key"> {
	constructor(private readonly shardingService: ShardingService) {
		super();
	}
	event = "request:get-public-key" as const;
	responseEvent = "response:get-public-key" as const;
	handler = async (payload: SignerInputEvent<"get-public-key">) => {
		const { publicKey } = await this.shardingService.getLocalKeyInstance(
			payload.authData,
			payload.data.chainLayer,
		);
		return {
			publicKey,
		};
	};
}

export class SignMessageEventHandler extends BaseEventHandler<"sign-message"> {
	constructor(
		private readonly shardingService: ShardingService,
		private readonly ed25519Service: Ed25519Service,
	) {
		super();
	}
	event = "request:sign-message" as const;
	responseEvent = "response:sign-message" as const;
	async handler(payload: SignerInputEvent<"sign-message">) {
		const { privateKey, publicKey } =
			await this.shardingService.getLocalKeyInstance(
				payload.authData,
				payload.data.chainLayer,
			);
		if (payload.data.chainLayer === "solana") {
			const signature = await this.ed25519Service.signMessage(
				payload.data.message,
				privateKey,
			);
			return { signature, publicKey };
		}
		throw new Error("Chain layer not implemented");
	}
}

export class SignTransactionEventHandler extends BaseEventHandler<"sign-transaction"> {
	constructor(
		private readonly shardingService: ShardingService,
		private readonly ed25519Service: Ed25519Service,
	) {
		super();
	}
	event = "request:sign-transaction" as const;
	responseEvent = "response:sign-transaction" as const;
	handler = async (payload: SignerInputEvent<"sign-transaction">) => {
		const { privateKey, publicKey } =
			await this.shardingService.getLocalKeyInstance(
				payload.authData,
				payload.data.chainLayer,
			);
		if (payload.data.chainLayer === "solana") {
			// TODO: try to delete the solana dependency
			const transaction = await VersionedTransaction.deserialize(
				base58Decode(payload.data.transaction),
			);
			const signerIndex = transaction.message.staticAccountKeys.findIndex(
				(key) => key.equals(new PublicKey(publicKey)),
			);
			const kp = Keypair.fromSecretKey(
				this.ed25519Service.getSecretKey(privateKey, publicKey),
			);
			await transaction.sign([kp]);
			return {
				publicKey,
				transaction: base58Encode(transaction.serialize()),
				signature: base58Encode(transaction.signatures[signerIndex]),
			};
		}
		throw new Error("Chain layer not implemented");
	};
}
