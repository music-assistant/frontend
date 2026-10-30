import type { CommandOptions } from "./commandOptions";
import type {
  AuthExchangeResult,
  AuthProvider,
  AuthToken,
  AuthorizationStart,
  Role,
  User,
} from "./interfaces";

type SendCommand = <Result>(
  command: string,
  args?: Record<string, unknown>,
  options?: CommandOptions,
) => Promise<Result>;

export class AccountApi {
  constructor(
    private readonly sendCommand: SendCommand,
    private readonly getDeviceName: () => string,
  ) {}

  public async getCurrentUserInfo(): Promise<User | null> {
    // Get current authenticated user information
    try {
      const result = await this.sendCommand<User>("auth/me");
      return result;
    } catch (error) {
      console.error("Failed to get current user info:", error);
      return null;
    }
  }

  public async getUserTokens(userId?: string): Promise<AuthToken[]> {
    // Get all tokens for current user or specific user (admin only)
    const args = userId ? { user_id: userId } : undefined;
    const tokens = await this.sendCommand<AuthToken[]>("auth/tokens", args);
    return tokens || [];
  }

  public async createToken(name: string, userId?: string): Promise<string> {
    // Create a new long-lived token for current user or specific user (admin only)
    const args: { name: string; user_id?: string } = { name };
    if (userId) args.user_id = userId;
    const result = await this.sendCommand<
      { success?: boolean; token: string } | string
    >("auth/token/create", args);

    if (typeof result === "string") {
      return result;
    }

    if (result.success === false) {
      throw new Error("Failed to create token");
    }

    if (!result.token) {
      throw new Error("Failed to create token");
    }

    return result.token;
  }

  public async revokeToken(tokenId: string): Promise<boolean> {
    // Revoke a token
    try {
      const result = await this.sendCommand<
        { success?: boolean } | boolean | null | undefined
      >("auth/token/revoke", {
        token_id: tokenId,
      });

      if (typeof result === "boolean") {
        return result;
      }

      if (
        result == null ||
        (typeof result === "object" && Object.keys(result).length === 0)
      ) {
        return true;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        return false;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === true
      ) {
        return true;
      }

      return true;
    } catch (error) {
      console.error("Error revoking token:", error);
      return false;
    }
  }

  public async getAuthProviders(): Promise<AuthProvider[]> {
    // Get list of available authentication providers
    return await this.sendCommand<AuthProvider[]>("auth/providers");
  }

  /**
   * Start a sign-in with a provider that redirects the browser.
   *
   * :param providerId: The login provider to sign in with.
   * :param returnUrl: The URL to come back to after signing in.
   * :param codeChallenge: The S256 challenge of the app's code verifier. With
   *     it the provider returns to the remote app, which completes the sign-in
   *     with exchangeAuthCode; only accepted over Remote Access.
   */
  public async startAuthorization(
    providerId: string,
    returnUrl: string,
    codeChallenge?: string,
  ): Promise<AuthorizationStart> {
    return await this.sendCommand<AuthorizationStart>(
      "auth/authorization_url",
      {
        provider_id: providerId,
        return_url: returnUrl,
        ...(codeChallenge && {
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          redirect_target: "app",
        }),
      },
    );
  }

  /**
   * Complete a sign-in that returned to the remote app.
   *
   * :param state: The state of the sign-in.
   * :param code: The authorization code it returned with.
   * :param codeVerifier: The code verifier of the challenge it started with.
   */
  public async exchangeAuthCode(
    state: string,
    code: string,
    codeVerifier: string,
  ): Promise<AuthExchangeResult> {
    return await this.sendCommand<AuthExchangeResult>("auth/exchange", {
      state,
      code,
      code_verifier: codeVerifier,
      device_name: this.getDeviceName(),
    });
  }

  public async logout(): Promise<boolean> {
    // Logout current user by revoking the current token
    const result = await this.sendCommand<{ success: boolean }>("auth/logout");
    return result.success;
  }

  // User management functions/commands (admin only)

  public async getAllUsers(): Promise<User[]> {
    // Get all users (admin only)
    const users = await this.sendCommand<User[]>("auth/users");
    return users;
  }

  public getRoles(options?: CommandOptions): Promise<Role[]> {
    // Get all user roles: the builtin roles first, then the custom roles by name
    return this.sendCommand<Role[]>("auth/roles", undefined, options);
  }

  public createRole(name: string, scopes: string[]): Promise<Role> {
    // Create a custom user role (admin only)
    return this.sendCommand(
      "auth/role/create",
      { name, scopes },
      // callers show the reason the server gives; avoid a duplicate global toast
      { suppressGlobalError: true },
    );
  }

  public updateRole(
    roleId: string,
    updates: { name?: string; scopes?: string[] },
  ): Promise<Role> {
    // Change the name and/or the scopes of a custom user role (admin only)
    return this.sendCommand(
      "auth/role/update",
      { role_id: roleId, ...updates },
      { suppressGlobalError: true },
    );
  }

  public deleteRole(roleId: string): Promise<void> {
    // Delete a custom user role that no user holds (admin only)
    return this.sendCommand(
      "auth/role/delete",
      { role_id: roleId },
      { suppressGlobalError: true },
    );
  }

  public async createUser(
    username: string,
    password: string,
    role: string,
    displayName?: string,
    playerFilter?: string[],
    options?: CommandOptions,
  ): Promise<User> {
    // Create a new user (admin only)
    try {
      const result = await this.sendCommand<
        { success?: boolean; user?: User } | User | null | undefined
      >(
        "auth/user/create",
        {
          username,
          password,
          role,
          display_name: displayName,
          player_filter: playerFilter,
        },
        options,
      );

      if (result == null) {
        throw new Error("Failed to create user");
      }

      if (typeof result === "object" && "user_id" in result) {
        return result as User;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        throw new Error("Failed to create user");
      }

      if (typeof result === "object" && "user" in result && result.user) {
        return result.user;
      }

      if (typeof result === "object" && "user_id" in result) {
        return result as User;
      }

      throw new Error("Failed to create user");
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  public async updateUser(
    userId: string,
    updates: {
      username?: string;
      displayName?: string;
      avatarUrl?: string;
      role?: string;
      password?: string;
      preferences?: Record<string, unknown>;
      player_filter?: string[];
    },
    options?: CommandOptions,
  ): Promise<User> {
    // Update user using unified update command
    try {
      const args: Record<string, unknown> = { user_id: userId };

      if (updates.username) args.username = updates.username;
      if (updates.displayName) args.display_name = updates.displayName;
      if (updates.avatarUrl) args.avatar_url = updates.avatarUrl;
      if (updates.role) args.role = updates.role;
      if (updates.password) args.password = updates.password;
      if (updates.preferences != undefined)
        args.preferences = updates.preferences;
      if (updates.player_filter != undefined)
        args.player_filter = updates.player_filter;

      const result = await this.sendCommand<
        { success?: boolean; user?: User } | User | null | undefined
      >("auth/user/update", args, options);

      if (result == null) {
        throw new Error("Failed to update user");
      }

      if (typeof result === "object" && "user_id" in result) {
        return result as User;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        throw new Error("Failed to update user");
      }

      if (typeof result === "object" && "user" in result && result.user) {
        return result.user;
      }

      if (typeof result === "object" && "user_id" in result) {
        return result as User;
      }

      throw new Error("Failed to update user");
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }

  public async enableUser(userId: string): Promise<boolean> {
    // Enable user (admin only)
    try {
      const result = await this.sendCommand<
        { success?: boolean } | boolean | null | undefined
      >("auth/user/enable", {
        user_id: userId,
      });

      if (typeof result === "boolean") {
        return result;
      }

      if (
        result == null ||
        (typeof result === "object" && Object.keys(result).length === 0)
      ) {
        return true;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error enabling user:", error);
      return false;
    }
  }

  public async deleteUser(userId: string): Promise<boolean> {
    // Delete user (admin only)
    try {
      const result = await this.sendCommand<
        { success?: boolean } | boolean | null | undefined
      >("auth/user/delete", {
        user_id: userId,
      });

      if (typeof result === "boolean") {
        return result;
      }

      if (
        result == null ||
        (typeof result === "object" && Object.keys(result).length === 0)
      ) {
        return true;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  public async disableUser(userId: string): Promise<boolean> {
    // Disable user (admin only)
    try {
      const result = await this.sendCommand<
        { success?: boolean } | boolean | null | undefined
      >("auth/user/disable", {
        user_id: userId,
      });

      if (typeof result === "boolean") {
        return result;
      }

      if (
        result == null ||
        (typeof result === "object" && Object.keys(result).length === 0)
      ) {
        return true;
      }

      if (
        typeof result === "object" &&
        "success" in result &&
        result.success === false
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error disabling user:", error);
      return false;
    }
  }
}
