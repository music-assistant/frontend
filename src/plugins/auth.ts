/**
 * Authentication Manager for Music Assistant Frontend
 * Handles token storage, JWT claims, and authentication state
 */

import { clearGuestQuizAffinity } from "@/helpers/guest_quiz_affinity";
import {
  clearGuestSessionStorage,
  GUEST_TOKEN_STORAGE_KEY,
} from "@/helpers/guest_session";
import type { ConnectionIdentity } from "@/helpers/connection_identity";
import type { User } from "./api/interfaces";
import { store } from "./store";

const TOKEN_STORAGE_KEY = "ma_access_token";
const TOKEN_CONNECTION_STORAGE_KEY = "ma_access_token_connection";

/**
 * JWT claims structure from Music Assistant tokens
 */
interface JWTClaims {
  sub: string; // user_id
  jti: string; // token_id
  iat: number; // issued at
  exp: number; // expiration
  username: string;
  role: string;
  permissions: string[];
  player_filter: string[];
  provider_filter: string[];
  token_name: string;
  is_long_lived: boolean;
}

export class AuthManager {
  private token: string | null = null;
  private claims: JWTClaims | null = null;
  private baseUrl: string = "";

  constructor() {
    this.loadStoredToken();
  }

  /**
   * Set the base URL for API calls
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Get the current authentication token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Get the saved regular-user token.
   */
  getPersistentToken(connectionIdentity: ConnectionIdentity): string | null {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return null;
    const claims = this.decodeJWT(token);
    if (isGuestAccessClaims(claims) || isCastViewerClaims(claims)) return null;
    return localStorage.getItem(TOKEN_CONNECTION_STORAGE_KEY) ===
      connectionIdentity
      ? token
      : null;
  }

  /**
   * Get the currently authenticated user
   */
  getCurrentUser(): User | undefined {
    return store.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null && store.currentUser !== null;
  }

  /**
   * Check if current user is admin
   */
  isAdmin(): boolean {
    return store.currentUser?.role === "admin";
  }

  /**
   * Set token directly (for server-side login flow)
   * Automatically decodes JWT claims for frontend use
   */
  setToken(token: string, connectionIdentity?: ConnectionIdentity): void {
    const previousIdentity = this.claims?.jti;
    this.token = token;
    this.claims = this.decodeJWT(token);
    if (this.isGuestAccessSession() || this.isCastViewer()) {
      sessionStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token);
      if (localStorage.getItem(TOKEN_STORAGE_KEY) === token) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } else {
      clearGuestSessionStorage();
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      if (connectionIdentity) {
        localStorage.setItem(TOKEN_CONNECTION_STORAGE_KEY, connectionIdentity);
      } else {
        localStorage.removeItem(TOKEN_CONNECTION_STORAGE_KEY);
      }
    }
    const nextIdentity = this.claims?.jti;
    if (!nextIdentity || previousIdentity !== nextIdentity) {
      clearGuestQuizAffinity();
    }
  }

  /**
   * Get decoded JWT claims
   */
  getClaims(): JWTClaims | null {
    return this.claims;
  }

  /**
   * Get a specific claim from the JWT
   */
  getClaim<K extends keyof JWTClaims>(key: K): JWTClaims[K] | undefined {
    return this.claims?.[key];
  }

  /**
   * Check if this is a party guest session.
   * Party guests authenticate via QR code/join code and have
   * restricted UI access (only the guest view).
   */
  isPartyGuest(): boolean {
    return this.claims?.username === "party_guest";
  }

  /**
   * Check if this is a music quiz guest session.
   * Music Quiz guests authenticate via QR code/join code and have
   * restricted UI access (only the quiz play view).
   */
  isMusicQuizGuest(): boolean {
    return this.claims?.username === "music_quiz_guest";
  }

  /**
   * Check if this is any guest access session (party or music quiz).
   * Guest sessions have restricted UI access.
   */
  isGuestAccessSession(): boolean {
    return this.isPartyGuest() || this.isMusicQuizGuest();
  }

  /**
   * Check if this is a cast viewer session.
   * Cast viewers authenticate via a one-time cast code (from casting a
   * dashboard to a Chromecast) and are pinned to a single dashboard route.
   */
  isCastViewer(): boolean {
    return this.claims?.username === "cast_viewer";
  }

  /**
   * Set current user
   */
  setCurrentUser(user: User): void {
    store.currentUser = user;
  }

  /**
   * Bind the current regular token to its authenticated connection.
   */
  bindPersistentToken(connectionIdentity: ConnectionIdentity): void {
    if (!this.token || this.isGuestAccessSession()) return;
    if (localStorage.getItem(TOKEN_STORAGE_KEY) !== this.token) return;
    localStorage.setItem(TOKEN_CONNECTION_STORAGE_KEY, connectionIdentity);
  }

  /**
   * End guest access while keeping any saved regular session.
   */
  clearGuestSession(): void {
    clearGuestSessionStorage();
    if (!this.isGuestAccessSession()) return;

    this.restorePersistentToken();
    store.currentUser = undefined;
    clearGuestQuizAffinity();
  }

  /**
   * Leave guest access and return to the full application.
   */
  leaveGuestSession(): void {
    if (!this.isGuestAccessSession()) return;

    this.clearGuestSession();
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.delete("join");
    returnUrl.hash = "/discover";
    window.history.replaceState({}, "", returnUrl);
    window.location.reload();
  }

  /**
   * Clear authentication token, claims, and user
   */
  clearAuth(): void {
    this.token = null;
    this.claims = null;
    store.currentUser = undefined;
    clearGuestQuizAffinity();
    clearGuestSessionStorage();
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_CONNECTION_STORAGE_KEY);
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    if (this.isGuestAccessSession()) {
      this.leaveGuestSession();
      return;
    }

    // Send logout command to server first (best effort)
    if (this.token) {
      try {
        // Import api dynamically to avoid circular dependency
        const { api } = await import("@/plugins/api");
        // Send logout command but don't wait for response to avoid race condition
        api.logout().catch(() => {
          // Ignore errors - we're logging out anyway
        });
      } catch (error) {
        // Ignore errors - we're logging out anyway
      }
    }

    // Clear auth immediately to prevent any auth error messages
    this.clearAuth();

    // Small delay to allow logout command to be sent
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Notify companion app launcher (if running in companion mode)
    // This navigates back to the server selection screen
    const { notifyCompanionLogout, isCompanionApp } =
      await import("@/plugins/companion");
    if (isCompanionApp()) {
      await notifyCompanionLogout();
      // Navigation is handled by the companion app, don't reload
      return;
    }

    // Reload page to show Vue login screen (browser mode)
    window.location.reload();
  }

  private loadStoredToken(): void {
    const guestToken = sessionStorage.getItem(GUEST_TOKEN_STORAGE_KEY);
    if (guestToken) {
      const guestClaims = this.decodeJWT(guestToken);
      if (isGuestAccessClaims(guestClaims) || isCastViewerClaims(guestClaims)) {
        this.token = guestToken;
        this.claims = guestClaims;
        return;
      }
      clearGuestSessionStorage();
    }

    const persistentToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const persistentClaims = persistentToken
      ? this.decodeJWT(persistentToken)
      : null;
    if (
      persistentToken &&
      (isGuestAccessClaims(persistentClaims) ||
        isCastViewerClaims(persistentClaims))
    ) {
      sessionStorage.setItem(GUEST_TOKEN_STORAGE_KEY, persistentToken);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_CONNECTION_STORAGE_KEY);
    }
    this.token = persistentToken;
    this.claims = persistentClaims;
  }

  private restorePersistentToken(): void {
    const persistentToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const persistentClaims = persistentToken
      ? this.decodeJWT(persistentToken)
      : null;
    if (
      persistentToken &&
      (isGuestAccessClaims(persistentClaims) ||
        isCastViewerClaims(persistentClaims))
    ) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      this.token = null;
      this.claims = null;
      return;
    }
    this.token = persistentToken;
    this.claims = persistentClaims;
  }

  /**
   * Decode JWT payload without signature verification.
   * Signature verification is the server's responsibility.
   * This allows the frontend to read claims from the self-contained token.
   */
  private decodeJWT(token: string): JWTClaims | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      // Base64url decode the payload (middle part)
      const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      // Add padding so length is a multiple of 4 (required by atob)
      let padded = payload;
      while (padded.length % 4 !== 0) {
        padded += "=";
      }
      const decoded = JSON.parse(atob(padded));
      return decoded as JWTClaims;
    } catch {
      return null;
    }
  }
}

function isGuestAccessClaims(claims: JWTClaims | null): boolean {
  return (
    claims?.username === "party_guest" ||
    claims?.username === "music_quiz_guest"
  );
}

function isCastViewerClaims(claims: JWTClaims | null): boolean {
  return claims?.username === "cast_viewer";
}

// Export singleton instance
export const authManager = new AuthManager();
export default authManager;
