// Shared predicates that decide which players this device owns and which of
// them may be shown in the UI.
import {
  PlaybackState,
  Player,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";

/**
 * Check if the player is (or streams to) the built-in player of this device.
 */
export const isBuiltinPlayer = function (player: Player): boolean {
  return (
    player.player_id === webPlayer.player_id ||
    player.player_id === store.companionPlayerId ||
    player.output_protocols.some(
      (x) =>
        x.output_protocol_id === webPlayer.player_id ||
        x.output_protocol_id === store.companionPlayerId,
    )
  );
};

export const isPlayerActive = function (player: Player): boolean {
  return (
    player.playback_state === PlaybackState.PLAYING ||
    player.playback_state === PlaybackState.PAUSED
  );
};

/**
 * Check if the player may be shown to the user.
 *
 * Set allowGroupChilds to also include players that are synced to or part of a
 * group, and allowNeedsSetup to include players that still need to be set up.
 */
export const playerVisible = function (
  player: Player,
  allowGroupChilds = false,
  allowNeedsSetup = false,
): boolean {
  // perform some basic checks if we may use/show the player
  if (!player.enabled) return false;
  if (player.synced_to && !allowGroupChilds) {
    return false;
  }
  if (player.active_group && !allowGroupChilds) return false;
  // A player that needs setup is serialized as unavailable. Only surface it
  // (dimmed, with a "Setup required" affordance) where a click launches its
  // setup flow (opt-in via allowNeedsSetup); elsewhere a click would select or
  // play the player, so an unusable needs_setup player must stay hidden.
  if (!player.available && !(player.needs_setup && allowNeedsSetup)) {
    return false;
  }
  if (isBuiltinPlayer(player)) {
    return true;
  }
  if (player.hide_in_ui) {
    return false;
  }
  if (
    store.currentUser &&
    store.currentUser.player_filter.length > 0 &&
    !store.currentUser.player_filter.includes(player.player_id)
  ) {
    // for non-admin users, the playerfilter is applied in the backend
    // but for admin users we need to filter here as well
    return false;
  }
  return true;
};

/**
 * Check if the player may be offered as a group member.
 *
 * Hiding a player only removes it from the main listings, so it stays pickable
 * here. Private players are the exception, because they belong to someone
 * else's device or to the server itself: those only show up once unhidden.
 */
export const groupMemberPickerVisible = function (player: Player): boolean {
  return isBuiltinPlayer(player) || !(player.hide_in_ui && player.private);
};

/**
 * Check if the player renders a now-playing view instead of audio.
 *
 * Screens and visualizers share a section in the group pickers, so the UI
 * treats them as one category.
 */
export const isVisualizerPlayer = function (player: Player): boolean {
  return (
    player.type === PlayerType.VISUALIZER || player.type === PlayerType.DISPLAY
  );
};

export const canEditPlayerGroup = function (player: Player): boolean {
  return (
    player.supported_features.includes(PlayerFeature.SET_MEMBERS) &&
    (player.can_group_with.length > 0 ||
      player.group_members.some(
        (playerId) =>
          playerId !== player.player_id &&
          !player.static_group_members.includes(playerId),
      ))
  );
};

export const getPlayerGroupMemberCount = function (player: Player): number {
  const childCount = new Set(
    player.group_members.filter((playerId) => playerId !== player.player_id),
  ).size;
  return player.type === PlayerType.GROUP ? childCount : childCount + 1;
};

export const isPlayerGrouped = function (player: Player): boolean {
  return player.type === PlayerType.GROUP
    ? player.group_members.length > 0
    : player.group_members.some((playerId) => playerId !== player.player_id);
};
