export class ApplicationError extends Error {
  public readonly cause?: unknown;
  constructor(
    message: string,
    public readonly code: string,
    error?: unknown
  ) {
    super(message);
    this.cause = error;
  }
}
