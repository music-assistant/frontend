/**
 * Tests for the visualizer's per-player preferences and their defaults.
 */
import {
  useVisualizer,
  visualizerEnabledForPlayer,
} from "@/composables/visualizer/useVisualizer";
import {
  VISUALIZER_BLUR_DEFAULT,
  VISUALIZER_OPACITY_DEFAULT,
} from "@/composables/visualizer/state";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMock = vi.hoisted(() => ({
  store: { currentUser: { preferences: {} as Record<string, unknown> } },
}));
vi.mock("@/plugins/store", () => storeMock);

const apiMock = vi.hoisted(() => ({
  api: { players: {} as Record<string, { legacy_ids: string[] }> },
}));
vi.mock("@/plugins/api", () => ({ ...apiMock, default: apiMock.api }));

vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: vi.fn(),
  useUserPreferences: () => ({
    getPreference: (_key: string, defaultValue: unknown) => ({
      value: defaultValue,
    }),
  }),
}));

vi.mock("@/plugins/visualizer-relay", () => ({
  visualizerCanRender: () => true,
  visualizerProviderAvailable: () => true,
}));

describe("visualizerEnabledForPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.store.currentUser = { preferences: {} };
    apiMock.api.players = {};
  });

  it("follows the expert mode until the preference is set", () => {
    storeMock.store.currentUser.preferences["expert_mode"] = true;
    expect(visualizerEnabledForPlayer("kitchen")).toBe(true);

    storeMock.store.currentUser.preferences["expert_mode"] = false;
    expect(visualizerEnabledForPlayer("kitchen")).toBe(false);

    storeMock.store.currentUser.preferences["expert_mode"] = true;
    storeMock.store.currentUser.preferences["visualizer_enabled"] = false;
    expect(visualizerEnabledForPlayer("kitchen")).toBe(false);
  });

  it("honours the preference, with the per-player one winning", () => {
    storeMock.store.currentUser.preferences["visualizer_enabled"] = true;
    expect(visualizerEnabledForPlayer("kitchen")).toBe(true);
    storeMock.store.currentUser.preferences["visualizer_enabled.kitchen"] =
      false;
    expect(visualizerEnabledForPlayer("kitchen")).toBe(false);
  });

  it("keeps the per-player preference of a player merged into this one", () => {
    apiMock.api.players = { kitchen: { legacy_ids: ["absorbed"] } };
    storeMock.store.currentUser.preferences["visualizer_enabled"] = true;
    storeMock.store.currentUser.preferences["visualizer_enabled.absorbed"] =
      false;
    expect(visualizerEnabledForPlayer("kitchen")).toBe(false);

    storeMock.store.currentUser.preferences["visualizer_enabled.kitchen"] =
      true;
    expect(visualizerEnabledForPlayer("kitchen")).toBe(true);
  });
});

describe("blur and opacity defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The same two numbers used to sit hardcoded in four places; these assertions
  // are what stops them drifting apart again.
  it("falls back to the shared constants when nothing is stored", () => {
    const { visualizerBlurPref, visualizerOpacityPref } =
      useVisualizer("kitchen");
    expect(visualizerBlurPref.value).toBe(VISUALIZER_BLUR_DEFAULT);
    expect(visualizerOpacityPref.value).toBe(VISUALIZER_OPACITY_DEFAULT);
  });

  it("starts unblurred at 40%, on a step the slider can land on", () => {
    expect(VISUALIZER_BLUR_DEFAULT).toBe(0);
    expect(VISUALIZER_OPACITY_DEFAULT).toBe(40);
    // the opacity slider runs 10..100 in steps of 5
    expect(VISUALIZER_OPACITY_DEFAULT % 5).toBe(0);
  });
});
