import { api } from "@/plugins/api";
import type { Player, PlayerConfig } from "@/plugins/api/interfaces";

type PlayerSetupInfo = Pick<Player, "needs_setup" | "has_setup_flow">;

/** The name shown for a player, which may only be configured and not registered yet. */
export const getPlayerName = (config: PlayerConfig): string =>
  config.name ||
  api.players[config.player_id]?.name ||
  config.default_name ||
  config.player_id;

export const getPlayerSetupLabel = (
  player?: PlayerSetupInfo,
): "configure_player" | "reconfigure_player" | undefined => {
  if (!player || (!player.has_setup_flow && !player.needs_setup)) {
    return undefined;
  }
  return player.needs_setup ? "configure_player" : "reconfigure_player";
};
