import type { KeyType } from '@crossmint/client-signers';
import { XMIFService } from './service';

export type ExportedKeyPairs = Partial<Record<KeyType, { privateKey: string; publicKey: string }>>;

export class ExportsService extends XMIFService {
  name = 'ExportsService';
  log_prefix = '[ExportsService]';

  private exportedKeys: ExportedKeyPairs = {};
  private isKeysReceived = false;

  setExportedKeys(keys: ExportedKeyPairs): void {
    this.log('Received exported keys from parent');
    this.exportedKeys = keys;
    this.isKeysReceived = true;
    this.notifyKeysReceived();
  }

  getAvailableKeyTypes(): KeyType[] {
    return Object.keys(this.exportedKeys) as KeyType[];
  }

  hasKeys(): boolean {
    return this.isKeysReceived && Object.keys(this.exportedKeys).length > 0;
  }

  showKeyType(keyType: KeyType): void {
    if (!this.isExportPageActive()) {
      this.logError('Export page elements not found. Make sure this is called from export.html');
      return;
    }

    if (!this.exportedKeys[keyType]) {
      this.logError(`Key type ${keyType} not found in exported keys`);
      this.updateStatus(`❌ Key type ${keyType} not available`, 'error');
      return;
    }

    try {
      const keyPair = this.exportedKeys[keyType];
      if (!keyPair || !keyPair.privateKey || !keyPair.publicKey) {
        throw new Error(`Key pair for ${keyType} is incomplete`);
      }

      const formattedPrivateKey = this.formatPrivateKeyForDisplay(keyType, keyPair.privateKey);
      const formattedPublicKey = this.formatPublicKeyForDisplay(keyType, keyPair.publicKey);

      this.updateDisplay(formattedPrivateKey, formattedPublicKey);
      this.updateStatus(`✅ Displaying ${keyType.toUpperCase()} key pair`, 'success');

      this.log(`Successfully displayed ${keyType} key pair`);
    } catch (error) {
      this.logError('Error displaying key:', error);
      this.updateStatus(
        `❌ Error displaying key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }

  clear(): void {
    this.log('Clearing export display');
    this.exportedKeys = {};
    this.isKeysReceived = false;

    this.updateDisplay('', '');
    this.updateStatus('', 'hidden');
    this.notifyKeysCleared();
  }

  private formatPrivateKeyForDisplay(keyType: KeyType, privateKey: string): string {
    let output = '# Private Key Export\n\n';
    output += `# ${keyType.toUpperCase()} Private Key\n`;
    output += `# Key type: ${keyType}\n\n`;

    const prefix = keyType === 'secp256k1' ? '0x' : '';
    output += `${prefix}${privateKey}\n\n`;

    output += '# WARNING: Keep this key secure and never share it publicly!\n';
    output += '# This key provides full access to associated wallets and assets.';

    return output;
  }

  private formatPublicKeyForDisplay(keyType: KeyType, publicKey: string): string {
    let output = '# Public Key Information\n\n';
    output += `# ${keyType.toUpperCase()} Public Key\n`;
    output += `# Key type: ${keyType}\n\n`;

    const prefix = keyType === 'secp256k1' ? '0x' : '';
    output += `${prefix}${publicKey}\n\n`;

    output += '# This is the public key corresponding to your private key.\n';
    output += '# Public keys can be safely shared and are used for verification.';

    return output;
  }

  private updateDisplay(privateKeyContent: string, publicKeyContent?: string): void {
    const privateKeysDisplay = document.getElementById(
      'private-keys-display'
    ) as HTMLTextAreaElement;
    const publicKeysDisplay = document.getElementById('public-keys-display') as HTMLTextAreaElement;
    const copyPrivateBtn = document.getElementById('copy-private-btn') as HTMLButtonElement;
    const copyPublicBtn = document.getElementById('copy-public-btn') as HTMLButtonElement;

    if (privateKeysDisplay) {
      privateKeysDisplay.value = privateKeyContent;
      if (privateKeyContent) {
        privateKeysDisplay.classList.add('has-content');
      } else {
        privateKeysDisplay.classList.remove('has-content');
        privateKeysDisplay.placeholder = 'Waiting for keys from parent application...';
      }
    }

    if (publicKeysDisplay && publicKeyContent) {
      publicKeysDisplay.value = publicKeyContent;
      if (publicKeyContent) {
        publicKeysDisplay.classList.add('has-content');
      } else {
        publicKeysDisplay.classList.remove('has-content');
        publicKeysDisplay.placeholder = 'Public key will be displayed here...';
      }
    }

    if (copyPrivateBtn) {
      copyPrivateBtn.disabled = !privateKeyContent;
    }

    if (copyPublicBtn) {
      copyPublicBtn.disabled = !publicKeyContent;
    }
  }

  private updateStatus(message: string, type: 'success' | 'error' | 'info' | 'hidden'): void {
    const exportStatus = document.getElementById('export-status') as HTMLDivElement;

    if (exportStatus) {
      if (type === 'hidden') {
        exportStatus.style.display = 'none';
      } else {
        exportStatus.style.display = 'block';
        exportStatus.textContent = message;
        exportStatus.className = `export-status ${type}`;
      }
    }
  }

  private notifyKeysReceived(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('xmif:keys-received', {
          detail: { keyTypes: this.getAvailableKeyTypes() },
        })
      );
    }
  }

  private notifyKeysCleared(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('xmif:keys-cleared'));
    }
  }

  isExportPageActive(): boolean {
    return document.getElementById('private-keys-display') !== null;
  }
}
