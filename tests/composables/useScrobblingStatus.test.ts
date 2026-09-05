import {
  getScrobblingProviderName,
  getScrobblingStatus,
} from "@/composables/useScrobblingStatus";
import {
  ProviderStatus,
  ProviderType,
  ConfigEntryType,
  type ConfigEntry,
  type PlayerConfig,
  type ProviderConfig,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";

const provider = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  type: ProviderType.PLUGIN,
  domain: "lastfm_scrobble",
  instance_id: "lastfm-1",
  enabled: true,
  name: null,
  default_name: "Last.fm",
  last_error: null,
  status: ProviderStatus.LOADED,
  values: {},
  ...overrides,
});

const player = (overrides: Partial<PlayerConfig> = {}): PlayerConfig => ({
  provider: "speaker",
  player_id: "player-1",
  enabled: true,
  name: null,
  default_name: "Speaker",
  values: {},
  ...overrides,
});

const selection = (value: string[]): ConfigEntry => ({
  key: "selection",
  category: "generic",
  type: ConfigEntryType.STRING,
  label: "Selection",
  default_value: [],
  required: false,
  options: [],
  value,
});

describe("useScrobblingStatus helpers", () => {
  it("omits the status when no scrobbling provider exists", () => {
    expect(getScrobblingStatus([provider({ domain: "party" })])).toEqual({
      configured: false,
      state: null,
      providerNames: [],
    });
  });

  it("reports an enabled provider as ready for the selected user and player", () => {
    expect(getScrobblingStatus([provider()], "user-1", player())).toMatchObject(
      {
        configured: true,
        state: "ready",
        providerNames: ["Last.fm"],
      },
    );
  });

  it("removes indicators for disabled or errored providers", () => {
    expect(
      getScrobblingStatus(
        [
          provider({ enabled: false }),
          provider({ status: ProviderStatus.ERROR, instance_id: "lastfm-2" }),
        ],
        "user-1",
        player(),
      ).configured,
    ).toBe(false);
  });

  it("includes multiple configured services", () => {
    const result = getScrobblingStatus(
      [
        provider({
          values: {
            scrobble_users: selection([]),
            scrobble_players: selection([]),
          },
        }),
        provider({
          domain: "listenbrainz_scrobble",
          instance_id: "listenbrainz-1",
          default_name: "ListenBrainz",
          values: {
            scrobble_users: selection([]),
            scrobble_players: selection([]),
          },
        }),
      ],
      "user-1",
      player(),
    );
    expect(result.providerNames).toEqual(["Last.fm", "ListenBrainz"]);
    expect(
      getScrobblingProviderName(provider({ domain: "subsonic_scrobble" })),
    ).toBe("Subsonic");
  });

  it("detects an enabled scrobble option on another provider", () => {
    expect(
      getScrobblingStatus(
        [
          provider({
            domain: "custom_music",
            values: {
              scrobble: {
                key: "scrobble",
                category: "generic",
                type: ConfigEntryType.BOOLEAN,
                label: "Scrobble plays",
                default_value: false,
                required: false,
                options: [],
                value: true,
              },
            },
          }),
        ],
        "user-1",
        player(),
      ).configured,
    ).toBe(true);
  });

  it("removes indicators when the current user or player is excluded", () => {
    const configured = provider({
      values: {
        scrobble_users: selection(["another-user"]),
        scrobble_players: selection(["another-player"]),
      },
    });
    expect(
      getScrobblingStatus([configured], "user-1", player()).configured,
    ).toBe(false);
    expect(
      getScrobblingStatus(
        [
          provider({
            values: { scrobble_players: selection(["another-player"]) },
          }),
        ],
        "user-1",
        player(),
      ).configured,
    ).toBe(false);
  });
});
