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
import { isSelectablePlayer } from "@/helpers/players";
import { getSleepTimerMenuItem, sleepTimerActive } from "@/helpers/sleep_timer";
import { resolveExternalSource } from "@/composables/externalSource";
import { resolveActiveSourceId } from "@/composables/activeSource";
import { useAnnouncement } from "@/composables/useAnnouncement";
import { useAudioOverlay } from "@/composables/useAudioOverlay";
import { visualizerProviderAvailable } from "@/plugins/visualizer-relay";
import { visualizerEnabledForPlayer } from "@/composables/visualizer/useVisualizer";
import VisualizerMenuControl from "@/layouts/default/PlayerOSD/VisualizerMenuControl.vue";
import { Droplet, Megaphone, Sparkles } from "@lucide/vue";
import { h, markRaw } from "vue";
import { useHosts } from "@/composables/ai-radio/useHosts";
import { useShows } from "@/composables/ai-radio/useShows";
import { authManager } from "@/plugins/auth";
import router from "@/plugins/router";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { getPlayerSetupLabel } from "@/helpers/player_config";
import { togglePlayerPower } from "@/helpers/player_group_playback";
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
  // the queue playing on this player, i.e. resolvePlayerQueue(player) — the
  // shuffle and repeat state and the source those commands are aimed at are
  // both derived from this pair
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
        return togglePlayerPower(player);
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
  // an external source orders its own session, so it takes these instead of the
  // queue — and it has no queue to read the state or the dynamic flag from
  const externalSource = resolveExternalSource(player, playerQueue);
  const shuffleSource = externalSource?.can_shuffle
    ? externalSource
    : undefined;
  const repeatSource = externalSource?.can_repeat ? externalSource : undefined;
  const orderableQueue = playerQueue && !isDynamic ? playerQueue : undefined;
  // the source the shuffle/repeat entries below are built for. Naming it on the
  // command lets the server refuse one whose source stopped playing while the
  // menu sat open, rather than let it land on whatever took the player since.
  const commandSourceId = resolveActiveSourceId(player);

  // shuffle (queue menu only; hidden when the dedicated control is visible)
  if (isQueue && (shuffleSource || orderableQueue) && !hideShuffleRepeat) {
    const shuffleEnabled = shuffleSource
      ? shuffleSource.shuffle_enabled === true
      : orderableQueue!.shuffle_enabled;
    menuItems.push({
      label: shuffleEnabled ? "shuffle_disable" : "shuffle_enable",
      labelArgs: [],
      action: () => {
        // the menu can sit open while the state moves, and an update lands as
        // an Object.assign onto these, so the value is settled at click time —
        // the source list is a fresh array by then, hence the re-resolve
        const enabled = shuffleSource
          ? resolveExternalSource(player, playerQueue)?.shuffle_enabled === true
          : orderableQueue!.shuffle_enabled === true;
        api.playerCommandShuffle(player.player_id, !enabled, commandSourceId);
      },
      icon: shuffleEnabled ? "mdi-shuffle-disabled" : "mdi-shuffle",
    });
  }

  // repeat (queue menu only; hidden when the dedicated control is visible)
  if (isQueue && (repeatSource || orderableQueue) && !hideShuffleRepeat) {
    // a source that has not reported its mode reads as off
    const repeatMode = repeatSource
      ? (repeatSource.repeat_mode ?? RepeatMode.OFF)
      : orderableQueue!.repeat_mode;
    menuItems.push({
      label: "select_repeat_mode",
      labelArgs: [],
      // keys spelled out so they stay greppable for the translation sync
      subItems: (
        [
          ["repeat_mode.off", RepeatMode.OFF],
          ["repeat_mode.all", RepeatMode.ALL],
          ["repeat_mode.one", RepeatMode.ONE],
        ] as const
      ).map(([label, mode]) => ({
        label,
        labelArgs: [],
        action: () => {
          api.playerCommandRepeat(player.player_id, mode, commandSourceId);
        },
        selected: repeatMode == mode,
      })),
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
            isSelectablePlayer(p) &&
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
  const { hosts, queueDjStatus, aiRadioAvailable, loadHosts } = useHosts();
  const { refreshDjStatus } = useShows();
  if (isQueue && playerQueue && aiRadioAvailable.value) {
    const queueId = playerQueue.queue_id;
    const queueDj = queueDjStatus.value[queueId];
    if (queueDj?.station_id) {
      const host = hosts.value.find((h) => h.id === queueDj.host_id);
      menuItems.push({
        label: host ? "ai_dj_show_on_air" : "ai_dj_show_on_air_unknown",
        labelArgs: host ? [host.name] : [],
        icon: markRaw(Sparkles),
        disabled: true,
      });
    } else {
      const activeHostId = queueDj?.host_id;
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
    void refreshDjStatus().catch(() => undefined);
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

  // MilkDrop visualizer popout (both menus), kept just above the settings
  // entry; the droplet fills while enabled for this player (live, since the
  // enabled preference is reactive store state)
  if (visualizerProviderAvailable()) {
    menuItems.push({
      label: "settings.visualizer_enabled.label",
      icon: markRaw(() =>
        h(Droplet, {
          fill: visualizerEnabledForPlayer(player.player_id)
            ? "currentColor"
            : "none",
        }),
      ),
      subComponent: markRaw(VisualizerMenuControl),
      componentProps: { playerId: player.player_id },
    });
  }

  // open the settings (both menus, admin only)
  if (authManager.isAdmin()) {
    const openSettings = (path: string) => () => {
      store.showFullscreenPlayer = false;
      store.showPlayersMenu = false;
      router.push(path);
    };
    if (isPlayer) {
      // the player settings page links on to the other sections from there
      menuItems.push({
        label: "open_settings",
        labelArgs: [],
        action: openSettings(`/settings/editplayer/${player.player_id}`),
        icon: "mdi-cog-outline",
      });
    } else {
      const subItems: ContextMenuItem[] = [];
      if (playerQueue) {
        subItems.push({
          label: "settings.queue_settings",
          labelArgs: [],
          action: openSettings(`/settings/editqueue/${playerQueue.queue_id}`),
        });
      }
      subItems.push({
        label: "settings.player_settings",
        labelArgs: [],
        action: openSettings(`/settings/editplayer/${player.player_id}`),
      });
      if (player.type !== PlayerType.GROUP) {
        subItems.push({
          label: "settings.category.dsp",
          labelArgs: [],
          action: openSettings(`/settings/editplayer/${player.player_id}/dsp`),
        });
      }
      menuItems.push({
        label: "open_settings",
        labelArgs: [],
        icon: "mdi-cog-outline",
        subItems,
      });
    }
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
