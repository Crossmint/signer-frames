type CrossmintFrameErrorCode = 'invalid-device-share';

export class CrossmintFrameCodedError extends Error {
  public readonly code: CrossmintFrameErrorCode;

  constructor(message: string, code: CrossmintFrameErrorCode) {
    super(message);
    this.code = code;
  }
}
