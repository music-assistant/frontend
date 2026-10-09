import { authManager } from "@/plugins/auth";
import { describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../tests/fixtures/scopes";
import { canUseQueueDj } from "./ai_radio_access";

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));

describe("canUseQueueDj", () => {
  it.each([
    { role: "a member", scopes: BUILTIN_ROLE_SCOPES.user, allowed: true },
    { role: "a guest", scopes: BUILTIN_ROLE_SCOPES.guest, allowed: false },
  ])("returns $allowed for $role", ({ scopes, allowed }) => {
    vi.mocked(authManager.hasScope).mockImplementation(scopeChecker(scopes));

    expect(canUseQueueDj()).toBe(allowed);
  });
});
