/**
 * Rejection value of a failed API command.
 *
 * `message` holds the server's (localized) error details, `error_code` the
 * numeric code to branch on.
 */
export class ApiCommandError extends Error {
  readonly error_code: number;

  constructor(message: string, errorCode: number) {
    super(message);
    this.name = "ApiCommandError";
    this.error_code = errorCode;
  }

  // callers render rejections with String(err); keep that the plain server
  // message instead of Error's "Error: <message>" form
  toString(): string {
    return this.message;
  }
}
