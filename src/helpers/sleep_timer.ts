// shared logic for the player sleep timer
// provides the quick-pick durations, helpers to read the remaining time and the
// menu items shown in the player/queue menus and the sleep timer indicator.
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { formatDuration } from "@/helpers/utils";
import api from "@/plugins/api";
import { resolvePlayerQueue } from "@/plugins/api/helpers";
import {
  MediaType,
  PlaybackState,
  Player,
  SleepTimerMode,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Moon, X } from "@lucide/vue";

// quick-pick durations (in minutes) offered when setting a sleep timer
const SLEEP_TIMER_PRESETS = [
  { minutes: 15, label: "sleep_timer_preset.15" },
  { minutes: 30, label: "sleep_timer_preset.30" },
  { minutes: 45, label: "sleep_timer_preset.45" },
  { minutes: 60, label: "sleep_timer_preset.60" },
  { minutes: 120, label: "sleep_timer_preset.120" },
];

const END_OF_ITEM_LABELS: Partial<Record<MediaType, string>> = {
  [MediaType.TRACK]: "sleep_timer_end_of_item.track",
  [MediaType.PODCAST_EPISODE]: "sleep_timer_end_of_item.podcast_episode",
  [MediaType.AUDIOBOOK]: "sleep_timer_end_of_item.audiobook",
};

type EndOfContentMode =
  SleepTimerMode.END_OF_ITEM | SleepTimerMode.END_OF_CHAPTER;

// The item or chapter end the player's sleep timer waits for, undefined for a
// duration timer or no timer.
const endOfContentMode = (player?: Player): EndOfContentMode | undefined => {
  const mode = player?.sleep_timer_mode;
  return mode === SleepTimerMode.END_OF_ITEM ||
    mode === SleepTimerMode.END_OF_CHAPTER
    ? mode
    : undefined;
};

const endOfContentLabel = (
  mode: EndOfContentMode,
  mediaType?: MediaType,
): string =>
  mode === SleepTimerMode.END_OF_CHAPTER
    ? "sleep_timer_end_of_chapter"
    : ((mediaType && END_OF_ITEM_LABELS[mediaType]) ??
      "sleep_timer_end_of_item.other");

// Label (translation key) of the item or chapter end an active sleep timer
// waits for, undefined for a timer that runs for a duration.
export const sleepTimerModeLabel = (player?: Player): string | undefined => {
  const mode = endOfContentMode(player);
  if (!mode) return undefined;
  const queueItem = resolvePlayerQueue(player)?.current_item;
  return endOfContentLabel(mode, queueItem?.media_item?.media_type);
};

// Whether the player currently has a sleep timer that will still fire.
export const sleepTimerActive = (player?: Player): boolean => {
  if (endOfContentMode(player)) return true;
  const expiresAt = player?.sleep_timer_expires_at;
  return expiresAt != null && expiresAt > Date.now() / 1000;
};

// Seconds remaining until the sleep timer stops playback (0 when inactive).
export const sleepTimerRemaining = (player?: Player): number => {
  const expiresAt = player?.sleep_timer_expires_at;
  if (expiresAt == null) return 0;
  return Math.max(0, expiresAt - Date.now() / 1000);
};

// Formatted countdown (mm:ss / h:mm:ss) for the remaining sleep timer time, or
// the item or chapter end it waits for while paused.
export const formatSleepTimerRemaining = (player?: Player): string => {
  const modeLabel = sleepTimerModeLabel(player);
  if (modeLabel && player?.sleep_timer_expires_at == null) return $t(modeLabel);
  return formatDuration(sleepTimerRemaining(player));
};

// Sleep timer menu items: a duration preset list, the end of the item or chapter
// playing from the queue, plus a cancel action when a timer is already running.
// Shared by the player/queue menus and the indicator.
export const getSleepTimerMenuItems = (player: Player): ContextMenuItem[] => {
  const menuItems: ContextMenuItem[] = SLEEP_TIMER_PRESETS.map((preset) => ({
    label: preset.label,
    labelArgs: [],
    action: () => api.setSleepTimer(player.player_id, preset.minutes * 60),
  }));
  const queue = resolvePlayerQueue(player);
  // the server only stops at the end of what a queue plays or holds paused
  const currentItem =
    queue &&
    !queue.ended &&
    [PlaybackState.PLAYING, PlaybackState.PAUSED].includes(queue.state)
      ? queue.current_item
      : undefined;
  // a server without sleep_timer_mode only takes a duration
  if (player.sleep_timer_mode !== undefined && currentItem?.duration) {
    const modes: EndOfContentMode[] = [SleepTimerMode.END_OF_ITEM];
    if (currentItem.media_item?.metadata?.chapters?.length) {
      modes.push(SleepTimerMode.END_OF_CHAPTER);
    }
    for (const mode of modes) {
      menuItems.push({
        label: endOfContentLabel(mode, currentItem.media_item?.media_type),
        labelArgs: [],
        action: () => api.setSleepTimer(player.player_id, undefined, mode),
        selected: player.sleep_timer_mode === mode,
      });
    }
  }
  if (sleepTimerActive(player)) {
    menuItems.push({
      label: "sleep_timer_cancel",
      labelArgs: [],
      action: () => api.clearSleepTimer(player.player_id),
      icon: X,
      color: "error",
    });
  }
  return menuItems;
};

// Single submenu entry for the player/queue context menus. Surfaces the
// remaining time alongside the label while a timer is active.
export const getSleepTimerMenuItem = (player: Player): ContextMenuItem => {
  const active = sleepTimerActive(player);
  return {
    label: active ? "sleep_timer_active" : "sleep_timer",
    labelArgs: active ? [formatSleepTimerRemaining(player)] : [],
    icon: Moon,
    subItems: getSleepTimerMenuItems(player),
  };
};
