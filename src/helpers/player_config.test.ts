import { getPlayerName, getPlayerSetupLabel } from "@/helpers/player_config";
import type { Player } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playerConfig } from "../../tests/fixtures/playerConfig";

const { apiMock } = vi.hoisted(() => ({
  // the players that registered, which is where a player without a name of
  // its own gets the one its provider reports
  apiMock: { players: {} as Record<string, Partial<Player>> },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

describe("getPlayerName", () => {
  beforeEach(() => {
    apiMock.players = {};
  });

  it("prefers the name the user gave the player", () => {
    apiMock.players = { kitchen: { name: "Kitchen speaker" } };

    expect(
      getPlayerName(
        playerConfig({ name: "Attic", default_name: "Chromecast" }),
      ),
    ).toBe("Attic");
  });

  it("falls back on the name the registered player goes by", () => {
    apiMock.players = { kitchen: { name: "Kitchen speaker" } };

    expect(getPlayerName(playerConfig({ default_name: "Chromecast" }))).toBe(
      "Kitchen speaker",
    );
  });

  it("falls back on the default name for a player that is not registered", () => {
    // a player that is switched off is unregistered, and the configuration is
    // all there is left to name it by
    expect(getPlayerName(playerConfig({ default_name: "Chromecast" }))).toBe(
      "Chromecast",
    );
  });

  it("falls back on the player id when nothing names it", () => {
    expect(getPlayerName(playerConfig({ default_name: null }))).toBe("kitchen");
  });
});

describe("getPlayerSetupLabel", () => {
  it("uses the required setup state even without an optional setup flow", () => {
    expect(
      getPlayerSetupLabel({
        needs_setup: true,
        has_setup_flow: false,
      }),
    ).toBe("configure_player");
  });

  it("only offers optional reconfiguration when the player supports it", () => {
    expect(
      getPlayerSetupLabel({
        needs_setup: false,
        has_setup_flow: true,
      }),
    ).toBe("reconfigure_player");
    expect(
      getPlayerSetupLabel({
        needs_setup: false,
        has_setup_flow: false,
      }),
    ).toBeUndefined();
  });
});
