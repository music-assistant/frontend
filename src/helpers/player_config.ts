import { api } from "@/plugins/api";
import type { Player, PlayerConfig } from "@/plugins/api/interfaces";

type PlayerSetupInfo = Pick<Player, "needs_setup" | "has_setup_flow">;

/** The name shown for a player, which may only be configured and not registered yet. */
export const getPlayerName = (config: PlayerConfig): string =>
  config.name ||
  api.players[config.player_id]?.name ||
  config.default_name ||
  config.player_id;

/** The players the players settings list shows, disabled ones included. */
export const getListedPlayerConfigs = (): Promise<PlayerConfig[]> =>
  api.getPlayerConfigs(undefined, false, false, true);

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
