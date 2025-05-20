export type XMIFErrorCode = 'invalid-device-share';

export class XMIFCodedError extends Error {
  public readonly code: XMIFErrorCode;

  constructor(message: string, code: XMIFErrorCode) {
    super(message);
    this.code = code;
  }
}
