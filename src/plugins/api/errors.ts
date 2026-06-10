// Error codes as defined in music_assistant_models/errors.py
export enum ApiErrorCode {
  UNKNOWN = 0,
  PROVIDER_UNAVAILABLE = 1,
  MEDIA_NOT_FOUND = 2,
}

export class ApiError extends Error {
  constructor(
    public readonly errorCode: number,
    details?: string,
  ) {
    super(details || `Server error (code ${errorCode})`);
    this.name = "ApiError";
  }
}

export function isMediaNotFoundError(err: unknown): boolean {
  return (
    err instanceof ApiError && err.errorCode === ApiErrorCode.MEDIA_NOT_FOUND
  );
}
