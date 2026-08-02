export const GUEST_TOKEN_STORAGE_KEY = "ma_guest_access_token";
export const GUEST_REMOTE_ID_STORAGE_KEY = "ma_guest_remote_id";
export const GUEST_SERVER_ADDRESS_STORAGE_KEY = "ma_guest_server_address";
export const PENDING_JOIN_CODE_STORAGE_KEY = "ma_pending_join_code";
export const PENDING_JOIN_TYPE_STORAGE_KEY = "ma_pending_join_type";
export const DASHBOARD_VIEWER_PATH_STORAGE_KEY = "ma_dashboard_viewer_path";
export const GUEST_SESSION_ENDED_STORAGE_KEY = "ma_guest_session_ended";

/** The kind of guest session a session-scoped token belonged to. */
export type GuestSessionKind = "party" | "music_quiz" | "dashboard";

const GUEST_SESSION_KINDS: readonly GuestSessionKind[] = [
  "party",
  "music_quiz",
  "dashboard",
];

/**
 * Remember that an established guest session was ended by the server.
 *
 * Deliberately not cleared by clearGuestSessionStorage: the marker is written
 * while the dead session is being torn down and has to outlive it, so the login
 * screen can explain what happened instead of showing a sign-in form.
 *
 * :param kind: The kind of guest session that ended.
 */
export function setGuestSessionEnded(kind: GuestSessionKind): void {
  sessionStorage.setItem(GUEST_SESSION_ENDED_STORAGE_KEY, kind);
}

/**
 * Return the kind of guest session that was ended by the server, if any.
 */
export function getGuestSessionEnded(): GuestSessionKind | null {
  const stored = sessionStorage.getItem(GUEST_SESSION_ENDED_STORAGE_KEY);
  return GUEST_SESSION_KINDS.includes(stored as GuestSessionKind)
    ? (stored as GuestSessionKind)
    : null;
}

export function clearGuestSessionEnded(): void {
  sessionStorage.removeItem(GUEST_SESSION_ENDED_STORAGE_KEY);
}

export function clearGuestSessionStorage(): void {
  sessionStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(GUEST_REMOTE_ID_STORAGE_KEY);
  sessionStorage.removeItem(GUEST_SERVER_ADDRESS_STORAGE_KEY);
  sessionStorage.removeItem(PENDING_JOIN_CODE_STORAGE_KEY);
  sessionStorage.removeItem(PENDING_JOIN_TYPE_STORAGE_KEY);
  sessionStorage.removeItem(DASHBOARD_VIEWER_PATH_STORAGE_KEY);
}
