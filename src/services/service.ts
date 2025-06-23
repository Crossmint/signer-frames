export abstract class CrossmintFrameService {
  abstract name: string;
  abstract log_prefix: string;
  log = (...args: unknown[]) => console.log(`${this.log_prefix}`, ...args);
  logError = (...args: unknown[]) => console.error(`${this.log_prefix}`, ...args);
  logDebug = (...args: unknown[]) => console.debug(`${this.log_prefix}`, ...args);
  public async init(): Promise<void> {}
}
