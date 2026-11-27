import { api } from "@/plugins/api";
import {
  PlayerType,
  type ConfigEntry,
  type Player,
  type PlayerConfig,
} from "@/plugins/api/interfaces";

type PlayerSetupInfo = Pick<Player, "needs_setup" | "has_setup_flow">;

/** The settings pages of a player that show entries of its config. */
export type PlayerConfigPage = "player" | "outputs" | "controls";

/** The name shown for a player, which may only be configured and not registered yet. */
export const getPlayerName = (config: PlayerConfig): string =>
  config.name ||
  api.players[config.player_id]?.name ||
  config.default_name ||
  config.player_id;

/** The players the players settings list shows: every player, also unavailable and disabled ones. */
export const getListedPlayerConfigs = (): Promise<PlayerConfig[]> =>
  api.getPlayerConfigs();

/**
 * Whether the player belongs to one of the given provider instances: it is one
 * of their players, or it plays through a protocol one of them provides.
 */
export const playerBelongsToProviders = (
  config: PlayerConfig,
  providerInstanceIds: string[],
): boolean => {
  const provider = api.getProvider(config.provider);
  if (!provider) return false;
  if (providerInstanceIds.includes(provider.instance_id)) return true;
  const domains = providerInstanceIds.map((id) => api.getProvider(id)?.domain);
  return !!api.players[config.player_id]?.output_protocols.some((protocol) =>
    domains.includes(protocol.protocol_domain),
  );
};

export const getPlayerSetupLabel = (
  player?: PlayerSetupInfo,
): "configure_player" | "reconfigure_player" | undefined => {
  if (!player || (!player.has_setup_flow && !player.needs_setup)) {
    return undefined;
  }
  return player.needs_setup ? "configure_player" : "reconfigure_player";
};

/** The settings page of a player that shows an entry of its config. */
export const getPlayerConfigPage = (
  entry: Pick<ConfigEntry, "category">,
  player: Pick<Player, "type">,
): PlayerConfigPage => {
  // the preferred output (protocol_general) and the settings of each output; a group
  // gets its own settings, its members among them, as those of its native output
  if (entry.category.startsWith("protocol_")) {
    return player.type === PlayerType.GROUP ? "player" : "outputs";
  }
  if (entry.category === "player_controls") return "controls";
  return "player";
};
