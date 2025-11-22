/**
 * Authentication Manager for Music Assistant Frontend
 * Handles token storage, authentication state, and auth API calls
 */

import type {
  User,
  AuthProvider,
  LoginRequest,
  LoginResponse,
  SetupRequest,
  ServerInfo,
  AuthToken,
  UserRole,
} from "./api/interfaces";

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
   * Get server info (including onboard status and auth requirements)
   */
  async getServerInfo(): Promise<ServerInfo> {
    const response = await fetch(`${this.baseUrl}/info`);
    if (!response.ok) {
      throw new Error(`Failed to fetch server info: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Get list of available authentication providers
   */
  async getAuthProviders(): Promise<AuthProvider[]> {
    const response = await fetch(`${this.baseUrl}/auth/providers`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch auth providers: ${response.statusText}`,
      );
    }
    const data = await response.json();
    return data.providers || [];
  }

  /**
   * Get a friendly device name for the current browser
   */
  private getDeviceName(): string {
    const ua = navigator.userAgent;
    let browser = "Unknown Browser";
    let os = "";

    // Detect browser
    if (ua.includes("Firefox")) {
      browser = "Firefox";
    } else if (ua.includes("Edg")) {
      browser = "Edge";
    } else if (ua.includes("Chrome")) {
      browser = "Chrome";
    } else if (ua.includes("Safari")) {
      browser = "Safari";
    }

    // Detect OS
    if (ua.includes("Win")) {
      os = "Windows";
    } else if (ua.includes("Mac")) {
      os = "macOS";
    } else if (ua.includes("Linux")) {
      os = "Linux";
    } else if (ua.includes("Android")) {
      os = "Android";
    } else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) {
      os = "iOS";
    }

    return `Music Assistant Web (${browser}${os ? " on " + os : ""})`;
  }

  /**
   * Login with credentials
   */
  async login(
    username: string,
    password: string,
    providerId: string = "builtin",
  ): Promise<LoginResponse> {
    const request: LoginRequest = {
      provider_id: providerId,
      credentials: { username, password },
      device_name: this.getDeviceName(),
    };

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    const result: LoginResponse = await response.json();

    if (result.success && result.token && result.user) {
      this.storeAuth(result.token, result.user);
    }

    return result;
  }

  /**
   * Complete initial setup by creating first admin user
   */
  async setup(
    username: string,
    password: string,
    displayName?: string,
  ): Promise<LoginResponse> {
    const request: SetupRequest = {
      username,
      password,
      display_name: displayName,
      device_name: this.getDeviceName(),
    };

    const response = await fetch(`${this.baseUrl}/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    const result: LoginResponse = await response.json();

    if (result.success && result.token && result.user) {
      this.storeAuth(result.token, result.user);
    }

    return result;
  }

  /**
   * Logout current user
   */
  logout(): void {
    this.clearAuth();
    // Redirect to server login page
    const returnUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `${this.baseUrl}/login?return_url=${returnUrl}`;
  }

  /**
   * Validate current token by fetching user info
   */
  async validateToken(): Promise<boolean> {
    if (!this.token) return false;

    try {
      const user = await this.getCurrentUserFromServer();
      if (user) {
        this.currentUser = user;
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        return true;
      }
    } catch (error) {
      console.error("Token validation failed:", error);
      this.clearAuth();
    }
    return false;
  }

  /**
   * Get current user from server (requires authentication)
   */
  async getCurrentUserFromServer(): Promise<User | null> {
    if (!this.token) return null;

    const response = await fetch(`${this.baseUrl}/auth/user`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (response.status === 401) {
      // Token is invalid
      this.clearAuth();
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Change password for current user
   */
  async changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    if (!this.token) return false;

    const response = await fetch(`${this.baseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });

    if (response.status === 401) {
      this.clearAuth();
      return false;
    }

    const result = await response.json();
    return result.success || false;
  }

  /**
   * Get all tokens for current user
   */
  async getUserTokens(): Promise<AuthToken[]> {
    if (!this.token) return [];

    const response = await fetch(`${this.baseUrl}/auth/tokens`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (response.status === 401) {
      this.clearAuth();
      return [];
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tokens || [];
  }

  /**
   * Create a new long-lived token
   */
  async createToken(name: string): Promise<string | null> {
    if (!this.token) return null;

    const response = await fetch(`${this.baseUrl}/auth/tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ name }),
    });

    if (response.status === 401) {
      this.clearAuth();
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to create token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.token || null;
  }

  /**
   * Revoke a token
   */
  async revokeToken(tokenId: string): Promise<boolean> {
    if (!this.token) return false;

    const response = await fetch(`${this.baseUrl}/auth/tokens/${tokenId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (response.status === 401) {
      this.clearAuth();
      return false;
    }

    const result = await response.json();
    return result.success || false;
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<User[]> {
    if (!this.token) return [];

    const response = await fetch(`${this.baseUrl}/auth/users`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (response.status === 401) {
      this.clearAuth();
      return [];
    }

    if (response.status === 403) {
      throw new Error("Admin access required");
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }

    const data = await response.json();
    return data.users || [];
  }

  /**
   * Create a new user (admin only)
   */
  async createUser(
    username: string,
    password: string,
    role: UserRole,
    displayName?: string,
  ): Promise<User | null> {
    if (!this.token) return null;

    const response = await fetch(`${this.baseUrl}/auth/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        username,
        password,
        role,
        display_name: displayName,
      }),
    });

    if (response.status === 401) {
      this.clearAuth();
      return null;
    }

    if (response.status === 403) {
      throw new Error("Admin access required");
    }

    if (!response.ok) {
      throw new Error(`Failed to create user: ${response.statusText}`);
    }

    const data = await response.json();
    return data.user || null;
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: string, role: UserRole): Promise<boolean> {
    if (!this.token) return false;

    const response = await fetch(
      `${this.baseUrl}/auth/users/${userId}/role`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ role }),
      },
    );

    if (response.status === 401) {
      this.clearAuth();
      return false;
    }

    if (response.status === 403) {
      throw new Error("Admin access required");
    }

    const result = await response.json();
    return result.success || false;
  }

  /**
   * Enable a user (admin only)
   */
  async enableUser(userId: string): Promise<boolean> {
    if (!this.token) return false;

    const response = await fetch(
      `${this.baseUrl}/auth/users/${userId}/enable`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      },
    );

    if (response.status === 401) {
      this.clearAuth();
      return false;
    }

    if (response.status === 403) {
      throw new Error("Admin access required");
    }

    const result = await response.json();
    return result.success || false;
  }

  /**
   * Disable a user (admin only)
   */
  async disableUser(userId: string): Promise<boolean> {
    if (!this.token) return false;

    const response = await fetch(
      `${this.baseUrl}/auth/users/${userId}/disable`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      },
    );

    if (response.status === 401) {
      this.clearAuth();
      return false;
    }

    if (response.status === 403) {
      throw new Error("Admin access required");
    }

    const result = await response.json();
    return result.success || false;
  }
}

// Export singleton instance
export const authManager = new AuthManager();
export default authManager;
