import type { User } from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";
import { user } from "../../tests/fixtures/user";
import { expertMode, expertModeOf, expertModeSetting } from "./expert_mode";

const { storeMock } = vi.hoisted(() => ({
  storeMock: { currentUser: undefined as User | undefined },
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

/** Sign in with these preferences on the account. */
function signInWith(preferences: Record<string, unknown>) {
  storeMock.currentUser = user({ preferences });
}

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

    // null is as unset as a missing key
    signInWith({ expert_mode: true, show_waveform: null });
    expect(expertModeSetting("show_waveform")).toBe(true);
  });
});
