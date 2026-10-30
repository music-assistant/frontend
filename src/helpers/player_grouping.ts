import { type Player, PlayerType } from "@/plugins/api/interfaces";

export const isPlayerGrouped = function (player: Player): boolean {
  return player.type === PlayerType.GROUP
    ? player.group_members.length > 0
    : player.group_members.some((playerId) => playerId !== player.player_id);
};
