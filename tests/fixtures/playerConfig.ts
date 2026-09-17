import { type PlayerConfig, PlayerType } from "@/plugins/api/interfaces";

/**
 * A complete player config, for tests that only care about a few of its
 * fields but should still model a payload the server can send.
 */
export function playerConfig(
  overrides: Partial<PlayerConfig> = {},
): PlayerConfig {
  return {
    player_id: "kitchen",
    provider: "chromecast--1",
    enabled: true,
    name: null,
    default_name: "Chromecast",
    player_type: PlayerType.PLAYER,
    values: {},
    ...overrides,
  };
}
