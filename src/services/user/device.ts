import { KeyPairProvider } from '@crossmint/client-signers-cryptography';
import { CrossmintFrameService } from '../service';

export class DeviceService extends CrossmintFrameService {
  name = 'Device Service';
  log_prefix = '[DeviceService]';
  constructor(private readonly keyProvider: KeyPairProvider) {
    super();
  }

  public async getId(): Promise<string> {
    this.log('Attempting to get device ID from storage');

    const masterKeyPair = await this.keyProvider.getKeyPair();
    const publicKeyBytes = new Uint8Array(
      await crypto.subtle.exportKey('spki', masterKeyPair.publicKey)
    );
    const deviceId = await crypto.subtle.digest('SHA-256', publicKeyBytes);
    const deviceIdHex = Array.from(new Uint8Array(deviceId))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    this.log(`Device ID: ${deviceIdHex}`);

    return deviceIdHex;
  }
}
