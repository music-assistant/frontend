import type { Player } from "@/plugins/api/interfaces";

type PlayerSetupInfo = Pick<Player, "needs_setup" | "has_setup_flow">;

export const getPlayerSetupLabel = (
  player?: PlayerSetupInfo,
): "configure_player" | "reconfigure_player" | undefined => {
  if (!player || (!player.has_setup_flow && !player.needs_setup)) {
    return undefined;
  }
  return player.needs_setup ? "configure_player" : "reconfigure_player";
};
