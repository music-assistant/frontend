/**
 * Pending sign-ins with an external identity provider that return to the app
 * through the app.music-assistant.io callback page.
 *
 * The key, the channel and the message shapes are shared with that page
 * (music-assistant/app.music-assistant.io, public/auth/callback/index.html).
 */

const STORAGE_KEY_PREFIX = "ma.external_login.";
const CHANNEL_NAME = "ma-external-login";
const PENDING_LIFETIME_MS = 10 * 60 * 1000;
const CALLBACK_PARAMS = ["code", "state", "error", "error_description"];

export interface PendingExternalLogin {
  verifier: string;
  remoteId: string;
  // same-origin path (with query and hash) the callback page returns to
  returnPath: string;
  createdAt: number;
}

export type ExternalLoginResult = {
  state: string;
  pending: PendingExternalLogin;
} & ({ code: string } | { error: string });

/**
 * Remember a started sign-in until the identity provider returns.
 *
 * It is kept in this tab and mirrored to localStorage, for a provider that
 * finishes in another tab.
 *
 * :param state: The state the server returned for the sign-in.
 * :param pending: The sign-in to remember.
 */
export function savePendingExternalLogin(
  state: string,
  pending: PendingExternalLogin,
): void {
  pruneExpired(localStorage);
  pruneExpired(sessionStorage);
  const value = JSON.stringify(pending);
  sessionStorage.setItem(STORAGE_KEY_PREFIX + state, value);
  localStorage.setItem(STORAGE_KEY_PREFIX + state, value);
}

/**
 * Return the current same-origin path to come back to after signing in.
 */
export function getExternalLoginReturnPath(): string {
  const url = new URL(window.location.href);
  for (const name of CALLBACK_PARAMS) url.searchParams.delete(name);
  return url.pathname + url.search + url.hash;
}

/**
 * Take the result of a sign-in that returned to this page, if any.
 *
 * Removes the callback parameters from the URL whenever a state is present;
 * a state without a pending sign-in of this browser is dropped.
 *
 * :return: The result with its pending sign-in, or null when the URL carries
 *     none (or one this browser did not start).
 */
export function takeExternalLoginReturn(): ExternalLoginResult | null {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state");
  if (state === null) return null;

  const url = new URL(window.location.href);
  for (const name of CALLBACK_PARAMS) url.searchParams.delete(name);
  window.history.replaceState(window.history.state, "", url.href);

  const ownPending = takePending(sessionStorage, state);
  const mirroredPending = takePending(localStorage, state);
  const pending = ownPending ?? mirroredPending;
  if (!pending) {
    console.warn(
      "[ExternalLogin] Ignoring a sign-in this browser didn't start",
    );
    return null;
  }
  return toResult(
    state,
    pending,
    params.get("code"),
    params.get("error_description") || params.get("error"),
  );
}

/**
 * Listen for the callback page handing a sign-in this tab started to it.
 *
 * :param onResult: Called with the result; the sign-in is no longer pending.
 * :return: A function that stops listening.
 */
export function listenForExternalLogin(
  onResult: (result: ExternalLoginResult) => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent) => {
    const data = event.data;
    if (data?.type !== CHANNEL_NAME || typeof data.state !== "string") return;
    // only this tab's own sign-in: the localStorage mirror is shared by every tab
    const pending = takePending(sessionStorage, data.state);
    if (!pending) return;
    localStorage.removeItem(STORAGE_KEY_PREFIX + data.state);
    channel.postMessage({ type: "ack", state: data.state });
    const result = toResult(
      data.state,
      pending,
      typeof data.code === "string" ? data.code : null,
      typeof data.error_description === "string" && data.error_description
        ? data.error_description
        : typeof data.error === "string"
          ? data.error
          : null,
    );
    if (result) onResult(result);
  };
  return () => channel.close();
}

function toResult(
  state: string,
  pending: PendingExternalLogin,
  code: string | null,
  error: string | null,
): ExternalLoginResult | null {
  if (code) return { state, pending, code };
  if (error) return { state, pending, error };
  return null;
}

function takePending(
  storage: Storage,
  state: string,
): PendingExternalLogin | null {
  const key = STORAGE_KEY_PREFIX + state;
  const pending = readPending(storage, key);
  storage.removeItem(key);
  return pending && !isExpired(pending) ? pending : null;
}

function readPending(
  storage: Storage,
  key: string,
): PendingExternalLogin | null {
  try {
    const pending = JSON.parse(storage.getItem(key) ?? "null");
    return typeof pending?.verifier === "string" &&
      typeof pending.remoteId === "string" &&
      typeof pending.createdAt === "number"
      ? pending
      : null;
  } catch {
    return null;
  }
}

function isExpired(pending: PendingExternalLogin): boolean {
  return Date.now() - pending.createdAt > PENDING_LIFETIME_MS;
}

function pruneExpired(storage: Storage): void {
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (!key?.startsWith(STORAGE_KEY_PREFIX)) continue;
    const pending = readPending(storage, key);
    if (!pending || isExpired(pending)) storage.removeItem(key);
  }
}
