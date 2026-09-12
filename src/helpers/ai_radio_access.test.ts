import { authManager } from "@/plugins/auth";
import { describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../tests/fixtures/scopes";
import { canOpenAIRadio, canUseQueueDj } from "./ai_radio_access";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { supportsAIRadioPlaybackScopes: false },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));

describe("canOpenAIRadio", () => {
  it.each([
    {
      role: "a member",
      scopes: BUILTIN_ROLE_SCOPES.user,
      schema: 74,
      playbackScopes: false,
      allowed: false,
    },
    {
      role: "a member",
      scopes: BUILTIN_ROLE_SCOPES.user,
      schema: 75,
      playbackScopes: true,
      allowed: true,
    },
    {
      role: "an admin",
      scopes: BUILTIN_ROLE_SCOPES.admin,
      schema: 74,
      playbackScopes: false,
      allowed: true,
    },
  ])(
    "returns $allowed for $role on API schema $schema",
    ({ scopes, playbackScopes, allowed }) => {
      vi.mocked(authManager.hasScope).mockImplementation(scopeChecker(scopes));
      apiMock.supportsAIRadioPlaybackScopes = playbackScopes;

      expect(canOpenAIRadio()).toBe(allowed);
    },
  );
});

describe("canUseQueueDj", () => {
  it.each([
    { role: "a member", scopes: BUILTIN_ROLE_SCOPES.user, allowed: true },
    { role: "a guest", scopes: BUILTIN_ROLE_SCOPES.guest, allowed: false },
  ])("returns $allowed for $role", ({ scopes, allowed }) => {
    vi.mocked(authManager.hasScope).mockImplementation(scopeChecker(scopes));

    expect(canUseQueueDj()).toBe(allowed);
  });
});
