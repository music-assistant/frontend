// shared logic to show player menu items
// this menu is shown in the full screen player and in the player list
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import api from "@/plugins/api";
import {
  Player,
  PlayerFeature,
  PlayerQueue,
  PlayerType,
  RepeatMode,
  PLAYER_CONTROL_NONE,
} from "@/plugins/api/interfaces";
import { getSleepTimerMenuItem, sleepTimerActive } from "@/helpers/sleep_timer";
import { useAnnouncement } from "@/composables/useAnnouncement";
import { useAudioOverlay } from "@/composables/useAudioOverlay";
import {
  toggleVisualizerForPlayer,
  visualizerEnabledForPlayer,
} from "@/composables/visualizer/useVisualizer";
import { visualizerProviderAvailable } from "@/plugins/visualizer-relay";
import { Droplet, Megaphone, Sparkles } from "@lucide/vue";
import { markRaw } from "vue";
import { useHosts } from "@/composables/ai-radio/useHosts";
import { useShows } from "@/composables/ai-radio/useShows";
import { authManager } from "@/plugins/auth";
import router from "@/plugins/router";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { getPlayerSetupLabel } from "@/helpers/player_config";
import { errorMessage } from "@/helpers/ai_radio";
import { toast } from "vue-sonner";

export const getPlayerSetupMenuItem = (
  player: Pick<Player, "player_id" | "needs_setup" | "has_setup_flow">,
): ContextMenuItem | undefined => {
  const label = getPlayerSetupLabel(player);
  if (!label) return undefined;

  return {
    label,
    labelArgs: [],
    action: () => {
      store.showFullscreenPlayer = false;
      store.showPlayersMenu = false;
      eventbus.emit("setupFlowDialog", {
        kind: "player",
        playerId: player.player_id,
      });
    },
    icon: "mdi-cog-refresh-outline",
  };
};

export const getPlayerMenuItems = (
  player: Player,
  playerQueue: PlayerQueue | undefined,
  options: {
    // which surface this menu is rendered on:
    // - "queue": the fullscreen player (now-playing/queue) overflow menu
    // - "player": the player list/select card menu
    context: "queue" | "player";
    // queue context only: when true, omit shuffle/repeat because dedicated
    // controls for them are currently visible (they are responsive and hidden
    // on small screens, so the overflow menu remains the fallback on mobile).
    hideShuffleRepeat?: boolean;
  },
): ContextMenuItem[] => {
  const menuItems: ContextMenuItem[] = [];
  const isQueue = options.context === "queue";
  const isPlayer = options.context === "player";
  const hideShuffleRepeat = options.hideShuffleRepeat === true;

  // power off/on (player menu only)
  if (isPlayer && player?.power_control != PLAYER_CONTROL_NONE) {
    menuItems.push({
      label: player.powered ? "power_off_player" : "power_on_player",
      labelArgs: [],
      action: () => {
        api.playerCommandPowerToggle(player.player_id);
      },
      icon: "mdi-power",
    });
  }

  // stop playback (both menus)
  if (
    player?.playback_state == "playing" ||
    player?.playback_state == "paused"
  ) {
    menuItems.push({
      label: "stop_playback",
      labelArgs: [],
      action: () => {
        api.playerCommandStop(player.player_id);
      },
      icon: "mdi-stop",
    });
  }

  // sleep timer (both menus); available while playing/paused or already running
  if (
    player?.playback_state == "playing" ||
    player?.playback_state == "paused" ||
    sleepTimerActive(player)
  ) {
    menuItems.push(getSleepTimerMenuItem(player));
  }

  const isDynamic = playerQueue?.is_dynamic === true;

  // shuffle (queue menu only; hidden when the dedicated control is visible)
  if (isQueue && playerQueue && !isDynamic && !hideShuffleRepeat) {
    menuItems.push({
      label: playerQueue.shuffle_enabled ? "shuffle_disable" : "shuffle_enable",
      labelArgs: [],
      action: () => {
        api.queueCommandShuffleToggle(playerQueue.queue_id);
      },
      icon: playerQueue.shuffle_enabled
        ? "mdi-shuffle-disabled"
        : "mdi-shuffle",
    });
  }

  // repeat (queue menu only; hidden when the dedicated control is visible)
  if (isQueue && playerQueue && !isDynamic && !hideShuffleRepeat) {
    menuItems.push({
      label: "select_repeat_mode",
      labelArgs: [],
      subItems: [
        {
          label: "repeat_mode.off",
          labelArgs: [],
          action: () => {
            api.queueCommandRepeat(playerQueue!.queue_id, RepeatMode.OFF);
          },
          selected: playerQueue.repeat_mode == RepeatMode.OFF,
        },
        {
          label: "repeat_mode.all",
          labelArgs: [],
          action: () => {
            api.queueCommandRepeat(playerQueue!.queue_id, RepeatMode.ALL);
          },
          selected: playerQueue.repeat_mode == RepeatMode.ALL,
        },
        {
          label: "repeat_mode.one",
          labelArgs: [],
          action: () => {
            api.queueCommandRepeat(playerQueue!.queue_id, RepeatMode.ONE);
          },
          selected: playerQueue.repeat_mode == RepeatMode.ONE,
        },
      ],
      icon: "mdi-repeat",
    });
  }

  // audio overlay (queue menu only; when a provider offering sound effects is
  // available). Opens the overlay dialog to pick a sound and set the volume;
  // a check marks it as active.
  const { overlayAvailable, openOverlayDialog } = useAudioOverlay();
  if (isQueue && playerQueue && overlayAvailable.value) {
    menuItems.push({
      label: "audio_overlay",
      labelArgs: [],
      action: () => {
        openOverlayDialog(playerQueue.queue_id);
      },
      icon: "mdi-waveform",
      selected: playerQueue.overlay_enabled,
    });
  }

  // play announcement (both menus; the server announces on any player, natively or
  // through its own fallback, so this only needs a TTS engine to speak the message)
  if (player.type !== PlayerType.PROTOCOL) {
    const { announcementAvailable, openAnnouncementDialog } = useAnnouncement();
    if (announcementAvailable.value) {
      menuItems.push({
        label: "play_announcement",
        labelArgs: [],
        action: () => {
          openAnnouncementDialog(player.player_id);
        },
        icon: markRaw(Megaphone),
      });
    }
  }

  // transfer queue (both menus; only when the queue is the active source)
  if (playerQueue?.active && playerQueue.items > 0) {
    menuItems.push({
      label: "transfer_queue",
      icon: "mdi-swap-horizontal",
      subItems: Object.values(api.players)
        .filter(
          (p) =>
            p.player_id != playerQueue!.queue_id &&
            p.player_id != player.player_id &&
            p.available &&
            p.enabled &&
            !p.synced_to &&
            !p.hide_in_ui,
        )
        .map((p) => {
          return {
            label: p.name,
            labelArgs: [],
            action: () => {
              api.queueCommandTransfer(playerQueue!.queue_id, p.player_id);
              store.activePlayerId = p.player_id;
            },
          };
        })
        .sort((a, b) =>
          a.label.toUpperCase() > b.label?.toUpperCase() ? 1 : -1,
        ),
    });
  }

  // clear queue (both menus; only when the queue has items)
  if (playerQueue?.items && playerQueue.items > 0) {
    menuItems.push({
      label: "queue_clear",
      labelArgs: [],
      action: () => {
        api.queueCommandClear(playerQueue!.queue_id);
      },
      icon: "mdi-cancel",
    });
  }

  // save queue as playlist (queue menu only)
  if (isQueue && playerQueue?.items && playerQueue.items > 0) {
    menuItems.push({
      label: "save_queue_as_playlist",
      labelArgs: [],
      action: () => {
        eventbus.emit("createPlaylist", { queueId: playerQueue!.queue_id });
      },
      icon: "mdi-playlist-plus",
    });
  }

  // select source (both menus; only when more than one source is selectable)
  const selectableSources = player.source_list.filter(
    (s) => !s.passive || s.id == player.active_source,
  );
  if (!player.synced_to && selectableSources.length > 1) {
    menuItems.push({
      label: "select_source",
      labelArgs: [],
      icon: "mdi-import",
      subItems: selectableSources
        .map((s) => {
          return {
            label: s.name,
            labelArgs: [],
            disabled: s.id == player.active_source,
            selected: s.id == player.active_source,
            action: () => {
              api.playerCommandGroupSelectSource(player.player_id, s.id);
            },
          };
        })
        .sort((a, b) =>
          a.label.toUpperCase() > b.label?.toUpperCase() ? 1 : -1,
        ),
    });
  }

  // Queue-only AI DJ entry, built from useHosts'/useShows' prefetched caches.
  // A queue runs exactly one host at a time, so while a show is on air its
  // host is that host: render it as a single disabled row rather than the
  // hosts submenu, which would otherwise show the (now irrelevant) sticky
  // queue-DJ assignment.
  const {
    hosts,
    queueDjStatus,
    aiRadioAvailable,
    loadHosts,
    loadQueueDjStatus,
  } = useHosts();
  const { sessions, shows, loadStatus } = useShows();
  if (isQueue && playerQueue && aiRadioAvailable.value) {
    const queueId = playerQueue.queue_id;
    const runningSession = sessions.value.find(
      (session) => session.status === "running" && session.queue_id === queueId,
    );
    if (runningSession) {
      const show = shows.value.find((s) => s.id === runningSession.station_id);
      const host = show
        ? hosts.value.find((h) => h.id === show.host_id)
        : undefined;
      menuItems.push({
        label: host ? "ai_dj_show_on_air" : "ai_dj_show_on_air_unknown",
        labelArgs: host ? [host.name] : [],
        icon: markRaw(Sparkles),
        disabled: true,
      });
    } else {
      const activeHostId = queueDjStatus.value[queueId];
      menuItems.push({
        label: "ai_dj",
        labelArgs: [],
        icon: markRaw(Sparkles),
        subItems: [
          ...hosts.value.map((host) => ({
            label: host.name,
            labelArgs: [],
            selected: activeHostId === host.id,
            action: () => assignQueueDj(queueId, host.id),
          })),
          {
            label: "ai_dj_off",
            labelArgs: [],
            selected: !activeHostId,
            action: () => assignQueueDj(queueId, null),
          },
        ],
      });
    }
    // Best-effort staleness refresh; the menu above is already built from
    // the prefetched caches, so a failure here has nothing to surface.
    void loadHosts().catch(() => undefined);
    void loadQueueDjStatus().catch(() => undefined);
    void loadStatus().catch(() => undefined);
  }

  // select sound mode (player menu only; only when more than one is selectable)
  const selectableSoundModes = player.sound_mode_list.filter(
    (s) => !s.passive || s.id == player.active_sound_mode,
  );
  if (isPlayer && selectableSoundModes.length > 1) {
    menuItems.push({
      label: "select_sound_mode",
      labelArgs: [],
      icon: "mdi-music-note-eighth",
      subItems: selectableSoundModes
        .map((s) => {
          return {
            label: s.name,
            labelArgs: [],
            disabled: s.id === player.active_sound_mode,
            selected: s.id === player.active_sound_mode,
            action: () => {
              api.playerCommandSelectSoundMode(player.player_id, s.id);
            },
          };
        })
        .sort((a, b) =>
          a.label.toUpperCase() > b.label?.toUpperCase() ? 1 : -1,
        ),
    });
  }

  // settings shortcuts (admin only)
  if (authManager.isAdmin()) {
    // open queue settings (queue menu, or player menu with an MA queue)
    if (isQueue || playerQueue) {
      menuItems.push({
        label: "open_queue_settings",
        labelArgs: [],
        action: () => {
          store.showFullscreenPlayer = false;
          store.showPlayersMenu = false;
          router.push(
            `/settings/editqueue/${playerQueue?.queue_id ?? player.player_id}`,
          );
        },
        icon: "mdi-cog-outline",
      });
    }

    // open player settings (both menus)
    menuItems.push({
      label: "open_player_settings",
      labelArgs: [],
      action: () => {
        store.showFullscreenPlayer = false;
        store.showPlayersMenu = false;
        router.push(`/settings/editplayer/${player.player_id}`);
      },
      icon: "mdi-cog-outline",
    });

    // configure the player or re-run its setup flow on demand
    if (isPlayer) {
      const setupMenuItem = getPlayerSetupMenuItem(player);
      if (setupMenuItem) menuItems.push(setupMenuItem);
    }

    // open dsp settings (player menu only)
    if (isPlayer && player.type !== PlayerType.GROUP) {
      menuItems.push({
        label: "open_dsp_settings",
        labelArgs: [],
        action: () => {
          store.showFullscreenPlayer = false;
          store.showPlayersMenu = false;
          router.push(`/settings/editplayer/${player.player_id}/dsp`);
        },
        icon: "mdi-equalizer",
      });
    }

    // open player options (both menus)
    if (player.options.length > 0) {
      menuItems.push({
        label: "player_options.open",
        labelArgs: [],
        action: () => {
          store.showFullscreenPlayer = false;
          store.showPlayersMenu = false;
          router.push(`/settings/editplayer/${player.player_id}/options`);
        },
        icon: "mdi-tune",
      });
    }
  }

  // MilkDrop visualizer on/off for this player (both menus; a player control,
  // stored as a per-player user preference). Kept at the bottom, with the
  // other display/appearance entries rather than the playback controls.
  if (visualizerProviderAvailable()) {
    menuItems.push({
      label: "settings.visualizer_enabled.label",
      action: () => toggleVisualizerForPlayer(player.player_id),
      icon: markRaw(Droplet),
      selected: visualizerEnabledForPlayer(player.player_id),
      close_on_click: false,
    });
  }

  return menuItems;
};

/** Assigns (or clears) a queue's AI DJ host, reporting a failed command to the user. */
async function assignQueueDj(
  queueId: string,
  hostId: string | null,
): Promise<void> {
  try {
    await useHosts().setQueueDj(queueId, hostId);
  } catch (error) {
    toast.error(errorMessage(error));
  }
}
