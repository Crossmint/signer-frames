import { CrossmintFrameService } from '../service';
import { type EncryptionService } from '../encryption';
import { encodeBytes } from '../common/utils';

export class DeviceService extends CrossmintFrameService {
  name = 'Device Service';
  log_prefix = '[DeviceService]';

  constructor(private readonly encryptionService: EncryptionService) {
    super();
  }

  async init() {}

  public async getId(): Promise<string> {
    this.log('Attempting to get device ID from public key');

    const publicKey = await this.encryptionService.getPublicKey();
    const publicKeyBuffer = new TextEncoder().encode(publicKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', publicKeyBuffer);
    const deviceId = encodeBytes(new Uint8Array(hashBuffer), 'hex');

    this.log(`Device ID from public key: ${deviceId.substring(0, 8)}...`);
    return deviceId;
  }

  public async clearId(): Promise<void> {
    this.log('Clearing device ID by clearing encryption keys');
    await this.encryptionService.clearKeys();
  }
}
