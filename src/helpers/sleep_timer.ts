// shared logic for the player sleep timer
// provides the quick-pick durations, helpers to read the remaining time and the
// menu items shown in the player/queue menus and the sleep timer indicator.
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { formatDuration } from "@/helpers/utils";
import api from "@/plugins/api";
import { Player } from "@/plugins/api/interfaces";
import { Moon, X } from "@lucide/vue";

// quick-pick durations (in minutes) offered when setting a sleep timer
const SLEEP_TIMER_PRESETS = [
  { minutes: 15, label: "sleep_timer_preset.15" },
  { minutes: 30, label: "sleep_timer_preset.30" },
  { minutes: 45, label: "sleep_timer_preset.45" },
  { minutes: 60, label: "sleep_timer_preset.60" },
  { minutes: 120, label: "sleep_timer_preset.120" },
];

// Whether the player currently has a sleep timer that will still fire.
export const sleepTimerActive = (player?: Player): boolean => {
  const expiresAt = player?.sleep_timer_expires_at;
  return expiresAt != null && expiresAt > Date.now() / 1000;
};

// Seconds remaining until the sleep timer stops playback (0 when inactive).
export const sleepTimerRemaining = (player?: Player): number => {
  const expiresAt = player?.sleep_timer_expires_at;
  if (expiresAt == null) return 0;
  return Math.max(0, expiresAt - Date.now() / 1000);
};

// Formatted countdown (mm:ss / h:mm:ss) for the remaining sleep timer time.
export const formatSleepTimerRemaining = (player?: Player): string => {
  return formatDuration(sleepTimerRemaining(player));
};

// Sleep timer menu items: a duration preset list, plus a cancel action when a
// timer is already running. Shared by the player/queue menus and the indicator.
export const getSleepTimerMenuItems = (player: Player): ContextMenuItem[] => {
  const menuItems: ContextMenuItem[] = SLEEP_TIMER_PRESETS.map((preset) => ({
    label: preset.label,
    labelArgs: [],
    action: () => api.setSleepTimer(player.player_id, preset.minutes * 60),
  }));
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
