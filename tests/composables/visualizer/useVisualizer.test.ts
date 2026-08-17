/**
 * Tests for the visualizer's per-player gating: the waveform is tapped from the
 * player's Sendspin stream, so players without a Sendspin output are never
 * offered a visualizer.
 */
import {
  playerSupportsVisualizer,
  visualizerEnabledForPlayer,
} from "@/composables/visualizer/useVisualizer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  players: {} as Record<string, unknown>,
  savePlayerConfig: vi.fn(async () => ({})),
  playerCommandResume: vi.fn(async () => {}),
}));
vi.mock("@/plugins/api", () => ({ default: apiMock }));

const storeMock = vi.hoisted(() => ({
  store: { currentUser: { preferences: {} as Record<string, unknown> } },
}));
vi.mock("@/plugins/store", () => storeMock);

vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: vi.fn(),
  useUserPreferences: () => ({ getPreference: () => ({ value: undefined }) }),
}));

vi.mock("@/plugins/visualizer-relay", () => ({
  visualizerCanRender: () => true,
  visualizerProviderAvailable: () => true,
}));

function player(
  domains: string[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    output_protocols: domains.map((domain) => ({
      protocol_domain: domain,
      output_protocol_id: domain === "sonos" ? "native" : `${domain}_out`,
    })),
    ...overrides,
  };
}

describe("playerSupportsVisualizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.players = {
      capable: player(["sonos", "sendspin"]),
      native_only: player(["sonos"]),
    };
  });

  it("accepts a player with a Sendspin output, whatever it plays over now", () => {
    expect(playerSupportsVisualizer("capable")).toBe(true);
  });

  it("rejects one without, an unknown id, and no id at all", () => {
    expect(playerSupportsVisualizer("native_only")).toBe(false);
    expect(playerSupportsVisualizer("nope")).toBe(false);
    expect(playerSupportsVisualizer(undefined)).toBe(false);
  });

  it("survives being called before the players map has loaded", () => {
    apiMock.players = undefined as unknown as Record<string, unknown>;
    expect(playerSupportsVisualizer("capable")).toBe(false);
  });
});

describe("visualizerEnabledForPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.players = {
      capable: player(["sendspin"]),
      native_only: player(["sonos"]),
    };
    storeMock.store.currentUser = { preferences: {} };
  });

  it("stays off for an incapable player even with a stored preference", () => {
    // acting on such a preference would only retry the relay forever
    storeMock.store.currentUser.preferences["visualizer_enabled"] = true;
    storeMock.store.currentUser.preferences["visualizer_enabled.native_only"] =
      true;
    expect(visualizerEnabledForPlayer("native_only")).toBe(false);
  });

  it("honours the preference for a capable player", () => {
    storeMock.store.currentUser.preferences["visualizer_enabled"] = true;
    expect(visualizerEnabledForPlayer("capable")).toBe(true);
    storeMock.store.currentUser.preferences["visualizer_enabled.capable"] =
      false;
    expect(visualizerEnabledForPlayer("capable")).toBe(false);
  });
});
