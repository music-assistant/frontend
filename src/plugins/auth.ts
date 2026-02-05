/**
 * Authentication Manager for Music Assistant Frontend
 * Handles token storage, JWT claims, and authentication state
 */

import type { User } from "./api/interfaces";
import { store } from "./store";

const TOKEN_STORAGE_KEY = "ma_access_token";

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
  provider_name?: string; // "party_mode" for party mode guests
}

export class AuthManager {
  private token: string | null = null;
  private claims: JWTClaims | null = null;
  private baseUrl: string = "";

  constructor() {
    this.token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (this.token) {
      this.claims = this.decodeJWT(this.token);
    }
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
      const decoded = JSON.parse(atob(payload));
      return decoded as JWTClaims;
    } catch {
      return null;
    }
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
  setToken(token: string): void {
    this.token = token;
    this.claims = this.decodeJWT(token);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
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
   * Get the provider name from JWT claims.
   * This identifies which provider created the session (e.g., "party_mode").
   * Returns undefined for regular login sessions.
   */
  getProviderName(): string | undefined {
    return this.claims?.provider_name;
  }

  /**
   * Check if this session was created by a specific provider.
   * Useful for providers that need to restrict UI access.
   */
  isProviderGuest(providerName: string): boolean {
    return this.claims?.provider_name === providerName;
  }

  /**
   * Check if this is a party mode guest session.
   * Party mode guests authenticate via QR code/join code and have
   * restricted UI access (only the guest view).
   */
  isPartyModeGuest(): boolean {
    return this.isProviderGuest("party_mode");
  }

  /**
   * Set current user
   */
  setCurrentUser(user: User): void {
    store.currentUser = user;
  }

  /**
   * Clear authentication token, claims, and user
   */
  clearAuth(): void {
    this.token = null;
    this.claims = null;
    store.currentUser = undefined;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
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
}
// Export singleton instance
export const authManager = new AuthManager();
export default authManager;
