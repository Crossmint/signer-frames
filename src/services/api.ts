/**
 * CrossmintApiService - Handles interaction with Crossmint API
 */

export class CrossmintApiService {
  constructor(
    private readonly url = process.env.NEXT_PUBLIC_CROSSMINT_API_URL ||
      'https://staging.crossmint.com'
  ) {}

  private get baseUrl() {
    return `${this.url}/api/unstable/wallets/ncs`;
  }

  private getHeaders({ jwt, apiKey }: { jwt: string; apiKey: string }) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      'x-api-key': apiKey,
    };
  }

  async createSigner(
    deviceId: string,
    authData: { jwt: string; apiKey: string },
    data: {
      authId: string;
    }
  ) {
    const response = await fetch(`${this.baseUrl}/${deviceId}`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: this.getHeaders(authData),
    });

    return response;
  }

  async sendOtp(
    deviceId: string,
    authData: { jwt: string; apiKey: string },
    data: {
      otp: string;
    }
  ) {
    const response = await fetch(`${this.baseUrl}/${deviceId}/auth`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: this.getHeaders(authData),
    }).then(res => res.json());

    return response;
  }

  async getKeyShare(
    deviceId: string,
    authData: { jwt: string; apiKey: string },
    data: {
      keyId: string;
    }
  ) {
    const response = await fetch(`${this.baseUrl}/${deviceId}`, {
      headers: this.getHeaders(authData),
    }).then(res => res.json());

    return response;
  }
}
