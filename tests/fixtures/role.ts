import type { Role } from "@/plugins/api/interfaces";

/**
 * A complete role, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function role(overrides: Partial<Role> = {}): Role {
  return {
    role_id: "role-id",
    name: "Role",
    scopes: [],
    builtin: false,
    ...overrides,
  };
}
