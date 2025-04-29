export abstract class XMIFService {
  abstract name: string;
  abstract init(): Promise<void>;
  abstract log_prefix: string;
  log = (...args: unknown[]) => console.log(`${this.log_prefix}`, ...args);
  logError = (...args: unknown[]) => console.error(`${this.log_prefix}`, ...args);
}
