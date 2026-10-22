import {
  getListedPlayerConfigs,
  getPlayerName,
  getPlayerSetupLabel,
  playerBelongsToProviders,
} from "@/helpers/player_config";
import type { MusicAssistantApi } from "@/plugins/api";
import { type Player, ProviderType } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { outputProtocol } from "../../tests/fixtures/outputProtocol";
import { playerConfig } from "../../tests/fixtures/playerConfig";
import { providerInstance } from "../../tests/fixtures/providerInstance";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getPlayerConfigs: vi.fn<MusicAssistantApi["getPlayerConfigs"]>(),
    getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
    // the players that registered, which is where a player without a name of
    // its own gets the one its provider reports
    players: {} as Record<string, Partial<Player>>,
  },
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

describe("getListedPlayerConfigs", () => {
  it("lists every player config, disabled ones included", async () => {
    const kitchen = playerConfig({ player_id: "kitchen", enabled: false });
    const office = playerConfig({ player_id: "office" });
    apiMock.getPlayerConfigs.mockResolvedValue([kitchen, office]);

    expect(await getListedPlayerConfigs()).toEqual([kitchen, office]);
    expect(apiMock.getPlayerConfigs).toHaveBeenCalledWith(
      undefined,
      false,
      false,
      true,
    );
  });
});

describe("playerBelongsToProviders", () => {
  beforeEach(() => {
    apiMock.players = {};
    apiMock.getProvider.mockImplementation((id) =>
      id.startsWith("airplay")
        ? providerInstance({ domain: "airplay", type: ProviderType.PLAYER })
        : providerInstance({ domain: "chromecast", type: ProviderType.PLAYER }),
    );
  });

  it("claims the players of the given provider instances", () => {
    const config = playerConfig({ provider: "chromecast--1" });

    expect(playerBelongsToProviders(config, ["chromecast--1"])).toBe(true);
    expect(playerBelongsToProviders(config, ["airplay--1"])).toBe(false);
  });

  it("claims the players that play through a protocol a given provider offers", () => {
    apiMock.players = {
      kitchen: {
        output_protocols: [outputProtocol({ protocol_domain: "airplay" })],
      },
    };

    expect(
      playerBelongsToProviders(
        playerConfig({ player_id: "kitchen", provider: "chromecast--1" }),
        ["airplay--1"],
      ),
    ).toBe(true);
  });

  it("claims no player whose own provider is not loaded", () => {
    apiMock.getProvider.mockReturnValue(undefined);

    expect(
      playerBelongsToProviders(playerConfig({ provider: "chromecast--1" }), [
        "chromecast--1",
      ]),
    ).toBe(false);
  });
});
