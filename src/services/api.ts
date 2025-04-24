/**
 * CrossmintApiService - Handles interaction with Crossmint API
 */

export class CrossmintApiService {
	async init() {}

	public getBaseUrl(apiKey: string) {
		const { environment } = parseApiKey(apiKey);
		const basePath = "api/unstable/wallets/ncs";
		let baseUrl: string;
		switch (environment) {
			case "development":
				baseUrl = "http://localhost:3000";
				break;
			case "staging":
				baseUrl = "https://staging.crossmint.com";
				break;
			case "production":
				baseUrl = "https://crossmint.com";
				break;
			default:
				throw new Error("Invalid environment");
		}
		return `${baseUrl}/${basePath}`;
	}

	private getHeaders({ jwt, apiKey }: { jwt: string; apiKey: string }) {
		return {
			"Content-Type": "application/json",
			Authorization: `Bearer ${jwt}`,
			"x-api-key": apiKey,
		};
	}

	async createSigner(
		deviceId: string,
		authData: { jwt: string; apiKey: string },
		data: {
			authId: string;
		},
	) {
		const response = await fetch(
			`${this.getBaseUrl(authData.apiKey)}/${deviceId}`,
			{
				method: "POST",
				body: JSON.stringify(data),
				headers: this.getHeaders(authData),
			},
		);

		return response;
	}

	async sendOtp(
		deviceId: string,
		authData: { jwt: string; apiKey: string },
		data: {
			otp: string;
		},
	): Promise<{
		shares: {
			device: string;
			auth: string;
		};
	}> {
		const response = await fetch(
			`${this.getBaseUrl(authData.apiKey)}/${deviceId}/auth`,
			{
				method: "POST",
				body: JSON.stringify(data),
				headers: this.getHeaders(authData),
			},
		).then((res) => res.json());

		return response;
	}

	async getAuthShard(
		deviceId: string,
		authData: { jwt: string; apiKey: string },
	): Promise<{
		deviceId: string;
		keyShare: string;
	}> {
		const response = await fetch(
			`${this.getBaseUrl(authData.apiKey)}/${deviceId}/key-shares`,
			{
				headers: this.getHeaders(authData),
			},
		).then((res) => res.json());

		return response;
	}
}

export function parseApiKey(apiKey: string): {
	origin: "server" | "client";
	environment: "development" | "staging" | "production";
} {
	let origin: "server" | "client";
	switch (apiKey.slice(0, 2)) {
		case "sk":
			origin = "server";
			break;
		case "ck":
			origin = "client";
			break;
		default:
			throw new Error("Invalid API key. Invalid origin");
	}

	const apiKeyWithoutOrigin = apiKey.slice(3);
	const envs = ["development", "staging", "production"] as const;
	const environment = envs.find((env) => apiKeyWithoutOrigin.startsWith(env));
	if (!environment) {
		throw new Error("Invalid API key. Invalid environment");
	}

	return {
		origin,
		environment,
	};
}
