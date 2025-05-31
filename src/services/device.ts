import { XMIFService } from './service';

const DEVICE_ID_KEY = 'device-id';

export class DeviceService extends XMIFService {
  name = 'Device Service';
  log_prefix = '[DeviceService]';

  public getId(): string {
    this.log('Attempting to get device ID from storage');

    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing != null) {
      this.log(`Found existing device ID: ${existing.substring(0, 8)}...`);
      return existing;
    }

    this.log('No existing device ID found, generating new one');
    const deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    this.log(`Successfully stored new device ID: ${deviceId.substring(0, 8)}...`);
    return deviceId;
  }

  public clearId(): void {
    this.log('Clearing device ID from storage');
    localStorage.removeItem(DEVICE_ID_KEY);
  }
}
