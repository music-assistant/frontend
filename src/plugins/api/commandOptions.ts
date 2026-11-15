export interface CommandOptions {
  /**
   * Skip the global console.error + error toast for an error result. Use for a
   * best-effort command whose failure the caller handles (or expects) itself.
   *
   * Pass a predicate for a command where only some failures are expected: it is
   * evaluated when the error arrives, not when the command is sent. The
   * returned promise rejects either way.
   */
  suppressGlobalError?: boolean | (() => boolean);
}
