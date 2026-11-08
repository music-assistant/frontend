/**
 * Rejection value of a failed API command.
 *
 * `message` is the server's (localized) reason, falling back to the numeric
 * `error_code` when the server sent no detail. `details` holds that reason
 * only when the server actually provided one, so callers can tell a real
 * message apart from the code fallback; `error_code` is the numeric code to
 * branch on, and `data` the context some errors carry for a client to act on.
 */
export class ApiCommandError extends Error {
  readonly error_code: number;
  readonly details?: string;
  readonly data?: Record<string, unknown>;

  constructor(
    message: string,
    errorCode: number,
    details?: string,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiCommandError";
    this.error_code = errorCode;
    this.details = details;
    this.data = data;
  }

  // callers render rejections with String(err); keep that the plain server
  // message instead of Error's "Error: <message>" form
  toString(): string {
    return this.message;
  }
}
