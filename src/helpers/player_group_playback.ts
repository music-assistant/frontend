import api from "@/plugins/api";
import { resolvePlayerQueue } from "@/plugins/api/helpers";
import {
  EventType,
  type Player,
  PlaybackState,
  PlayerType,
} from "@/plugins/api/interfaces";
import { eventbus, type PlayerGroupPlaybackChange } from "@/plugins/eventbus";
import { store } from "@/plugins/store";

const PLAYBACK_TRANSFER_TIMEOUT = 10_000;

type PlayerAction = () => void | Promise<void>;

export function requestGroupPlaybackConfirmation(
  player: Player,
  change: PlayerGroupPlaybackChange,
  onKeepPlaying: PlayerAction,
): boolean {
  if (!canTransferGroupPlayback(player)) return false;

  eventbus.emit("playerGroupPlaybackDialog", {
    change,
    playerName: player.name,
    onKeepPlaying: () => keepPlaying(player.player_id, onKeepPlaying),
    onStopAndUngroup: () =>
      stopAndUngroup(player.player_id, change === "power_off"),
  });
  return true;
}

export function togglePlayerPower(player: Player): void | Promise<void> {
  if (player.powered !== true) {
    return api.playerCommandPower(player.player_id, true);
  }
  if (
    requestGroupPlaybackConfirmation(player, "power_off", () =>
      api.playerCommandPower(player.player_id, false),
    )
  ) {
    return;
  }
  return api.playerCommandPower(player.player_id, false);
}

function canTransferGroupPlayback(player: Player): boolean {
  const queue = resolvePlayerQueue(player);
  return (
    player.type !== PlayerType.GROUP &&
    player.synced_to === null &&
    queue !== undefined &&
    queue.state !== PlaybackState.IDLE &&
    getAvailableGroupMembers(player).length > 0
  );
}

async function keepPlaying(
  playerId: string,
  onKeepPlaying: PlayerAction,
): Promise<void> {
  const player = api.players[playerId];
  const stopFollowing = player
    ? followPlaybackTransfer(playerId, getAvailableGroupMembers(player))
    : undefined;
  try {
    await onKeepPlaying();
  } catch (error) {
    stopFollowing?.();
    throw error;
  }
}

async function stopAndUngroup(
  playerId: string,
  powerOff: boolean,
): Promise<void> {
  const player = api.players[playerId];
  const memberIds = new Set([playerId, ...(player?.group_members ?? [])]);
  await api.playerCommandSetMembers(playerId, undefined, Array.from(memberIds));
  if (powerOff) await api.playerCommandPower(playerId, false);
}

function followPlaybackTransfer(
  previousLeaderId: string,
  memberIds: string[],
): () => void {
  if (store.activePlayerId !== previousLeaderId) return () => undefined;

  let unsubscribe: (() => void) | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const stopFollowing = () => {
    unsubscribe?.();
    unsubscribe = undefined;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = undefined;
  };
  const scheduleStopFollowing = () => queueMicrotask(stopFollowing);
  const selectTransferredPlayer = () => {
    if (store.activePlayerId !== previousLeaderId) {
      scheduleStopFollowing();
      return;
    }
    const newLeader = memberIds
      .map((playerId) => api.players[playerId])
      .find((player) => {
        if (!player || player.synced_to !== null) return false;
        const queue = resolvePlayerQueue(player);
        return (
          queue?.queue_id === player.player_id &&
          queue.state !== PlaybackState.IDLE
        );
      });
    if (!newLeader) return;

    store.activePlayerId = newLeader.player_id;
    scheduleStopFollowing();
  };

  unsubscribe = api.subscribe_multi(
    [EventType.PLAYER_UPDATED, EventType.QUEUE_UPDATED],
    selectTransferredPlayer,
  );
  timeoutId = setTimeout(stopFollowing, PLAYBACK_TRANSFER_TIMEOUT);
  queueMicrotask(selectTransferredPlayer);
  return stopFollowing;
}

function getAvailableGroupMembers(player: Player): string[] {
  return player.group_members.filter(
    (playerId) =>
      playerId !== player.player_id &&
      api.players[playerId]?.available === true,
  );
}
