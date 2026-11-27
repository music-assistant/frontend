import type { Scope, User } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../tests/fixtures/scopes";
import { user } from "../../tests/fixtures/user";
import {
  defaultExpertMode,
  expertMode,
  expertModeOf,
  expertModeSetting,
} from "./expert_mode";

const { storeMock } = vi.hoisted(() => ({
  storeMock: { currentUser: undefined as User | undefined },
}));

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

/** Sign in with these preferences on the account, as a member by default. */
function signInWith(
  preferences: Record<string, unknown>,
  scopes: readonly Scope[] = BUILTIN_ROLE_SCOPES.user,
) {
  vi.mocked(authManager.hasScope).mockImplementation(scopeChecker(scopes));
  storeMock.currentUser = user({ preferences });
}

/** Sign in as the admin, with these preferences on the account. */
function signInAsAdmin(preferences: Record<string, unknown>) {
  signInWith(preferences, BUILTIN_ROLE_SCOPES.admin);
}

beforeEach(() => {
  storeMock.currentUser = undefined;
  vi.mocked(authManager.hasScope).mockReturnValue(false);
});

describe("the expert mode an account's answers amount to", () => {
  it("is nothing for an account that was never asked", () => {
    expect(expertModeOf(undefined, undefined)).toBeUndefined();
    expect(expertModeOf(null, null)).toBeUndefined();
  });

  it.each([
    [true, true],
    [false, false],
  ])("is the flag when it is set (%s)", (flag, expected) => {
    // the flag wins over whatever an earlier welcome wrote
    expect(expertModeOf(flag, "enthusiast")).toBe(expected);
  });

  it("falls back on what an earlier welcome wrote as a persona", () => {
    expect(expertModeOf(undefined, "enthusiast")).toBe(true);
    expect(expertModeOf(undefined, "regular")).toBe(false);
  });
});

describe("the signed-in user's expert mode", () => {
  it("is off without an account or an answer", () => {
    storeMock.currentUser = undefined;
    expect(expertMode()).toBe(false);

    signInWith({});
    expect(expertMode()).toBe(false);
  });

  it("follows the flag, and the old persona until the flag is set", () => {
    signInWith({ expert_mode: true });
    expect(expertMode()).toBe(true);

    signInWith({ "onboarding.persona": "enthusiast" });
    expect(expertMode()).toBe(true);

    signInWith({ "onboarding.persona": "enthusiast", expert_mode: false });
    expect(expertMode()).toBe(false);
  });

  it.each([
    ["without an intent", {}],
    ["set up as a music hub", { "onboarding.intent": "music_hub" }],
  ])("is on for an admin who never answered, %s", (_, preferences) => {
    signInAsAdmin(preferences);
    expect(expertMode()).toBe(true);
  });

  it("is off for an admin who set up the app for the phone apps", () => {
    signInAsAdmin({ "onboarding.intent": "phone_apps" });
    expect(expertMode()).toBe(false);
  });

  it.each([
    ["a member", {}, BUILTIN_ROLE_SCOPES.user],
    ["an admin", {}, BUILTIN_ROLE_SCOPES.admin],
    [
      "a music hub admin",
      { "onboarding.intent": "music_hub" },
      BUILTIN_ROLE_SCOPES.admin,
    ],
    [
      "a phone apps admin",
      { "onboarding.intent": "phone_apps" },
      BUILTIN_ROLE_SCOPES.admin,
    ],
  ])("follows the flag of %s", (_, preferences, scopes) => {
    signInWith({ ...preferences, expert_mode: true }, scopes);
    expect(expertMode()).toBe(true);

    signInWith({ ...preferences, expert_mode: false }, scopes);
    expect(expertMode()).toBe(false);
  });

  it("follows the old persona of an admin over the admin's default", () => {
    signInAsAdmin({ "onboarding.persona": "regular" });
    expect(expertMode()).toBe(false);
  });
});

describe("the default expert mode of the signed-in user", () => {
  it("is what the account amounts to without the flag", () => {
    signInAsAdmin({ expert_mode: false });
    expect(defaultExpertMode()).toBe(true);

    signInWith({ expert_mode: true });
    expect(defaultExpertMode()).toBe(false);

    signInWith({ "onboarding.persona": "enthusiast", expert_mode: false });
    expect(defaultExpertMode()).toBe(true);
  });
});

describe("a setting that follows the expert mode", () => {
  it("is what the user set, whatever the mode", () => {
    signInWith({ expert_mode: true, show_waveform: false });
    expect(expertModeSetting("show_waveform")).toBe(false);

    signInWith({ expert_mode: false, show_waveform: true });
    expect(expertModeSetting("show_waveform")).toBe(true);
  });

  it("follows the mode until it is set", () => {
    signInWith({ expert_mode: true });
    expect(expertModeSetting("show_waveform")).toBe(true);

    signInWith({});
    expect(expertModeSetting("show_waveform")).toBe(false);

    signInAsAdmin({});
    expect(expertModeSetting("show_waveform")).toBe(true);

    // null is as unset as a missing key
    signInWith({ expert_mode: true, show_waveform: null });
    expect(expertModeSetting("show_waveform")).toBe(true);
  });
});
