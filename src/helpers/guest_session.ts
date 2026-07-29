export const GUEST_TOKEN_STORAGE_KEY = "ma_guest_access_token";
export const GUEST_REMOTE_ID_STORAGE_KEY = "ma_guest_remote_id";
export const GUEST_SERVER_ADDRESS_STORAGE_KEY = "ma_guest_server_address";
export const PENDING_JOIN_CODE_STORAGE_KEY = "ma_pending_join_code";
export const PENDING_JOIN_TYPE_STORAGE_KEY = "ma_pending_join_type";
export const DASHBOARD_VIEWER_PATH_STORAGE_KEY = "ma_dashboard_viewer_path";

export function clearGuestSessionStorage(): void {
  sessionStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(GUEST_REMOTE_ID_STORAGE_KEY);
  sessionStorage.removeItem(GUEST_SERVER_ADDRESS_STORAGE_KEY);
  sessionStorage.removeItem(PENDING_JOIN_CODE_STORAGE_KEY);
  sessionStorage.removeItem(PENDING_JOIN_TYPE_STORAGE_KEY);
  sessionStorage.removeItem(DASHBOARD_VIEWER_PATH_STORAGE_KEY);
}
