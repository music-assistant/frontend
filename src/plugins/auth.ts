/**
 * Authentication Manager for Music Assistant Frontend
 * Handles token storage, and authentication state
 */

import type { User, ServerInfo } from "./api/interfaces";

const TOKEN_STORAGE_KEY = "ma_access_token";
const USER_STORAGE_KEY = "ma_current_user";

export class AuthManager {
  private token: string | null = null;
  private currentUser: User | null = null;
  private baseUrl: string = "";

  constructor() {
    // Load token and user from localStorage on init
    this.token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      try {
        this.currentUser = JSON.parse(storedUser);
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
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
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null && this.currentUser !== null;
  }

  /**
   * Check if current user is admin
   */
  isAdmin(): boolean {
    return this.currentUser?.role === "admin";
  }

  /**
   * Set token directly (for server-side login flow)
   */
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  /**
   * Set current user (for ingress mode where user info comes from backend)
   */
  setCurrentUser(user: User): void {
    this.currentUser = user;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  /**
   * Store authentication token and user
   */
  private storeAuth(token: string, user: User): void {
    this.token = token;
    this.currentUser = user;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  /**
   * Clear authentication token and user
   */
  clearAuth(): void {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
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

    // Redirect to server login page
    const returnUrl = encodeURIComponent(
      window.location.origin + window.location.pathname,
    );
    // Handle trailing slash to prevent double slashes
    const baseUrl = this.baseUrl.endsWith("/")
      ? this.baseUrl.slice(0, -1)
      : this.baseUrl;
    window.location.href = `${baseUrl}/login?return_url=${returnUrl}`;
  }
}
// Export singleton instance
export const authManager = new AuthManager();
export default authManager;
