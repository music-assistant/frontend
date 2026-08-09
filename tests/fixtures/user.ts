import { type User, UserRole } from "@/plugins/api/interfaces";

/**
 * A complete user, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function user(overrides: Partial<User> = {}): User {
  return {
    user_id: "user-id",
    username: "user",
    role: UserRole.USER,
    enabled: true,
    created_at: "2024-01-01T00:00:00Z",
    preferences: {},
    provider_filter: [],
    player_filter: [],
    ...overrides,
  };
}
